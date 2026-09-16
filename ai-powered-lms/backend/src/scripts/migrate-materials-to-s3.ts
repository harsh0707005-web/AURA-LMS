import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";
import { storageService } from "../services/storage/storage.service.js";

export interface MigrationResult {
  success: boolean;
  total: number;
  migrated: number;
  alreadyExists: number;
  skippedMissing: number;
  failed: number;
  reason?: string;
  details?: any;
}

export async function migrateMaterialsToS3(): Promise<MigrationResult> {
  console.log("=================================================");
  console.log("AURA LMS: Local to S3 Material Migration Script");
  console.log("=================================================");

  const s3Provider = storageService.getS3StorageProvider();
  const localProvider = storageService.getLocalStorageProvider();

  // 1. Verify S3 configuration and connectivity using canonical S3_BUCKET_NAME & S3_REGION
  const s3Health = await s3Provider.getHealth();
  if (!s3Health.healthy) {
    console.error(
      `[MIGRATION ERROR] S3 storage provider is unhealthy or unconfigured:`,
      s3Health.details
    );
    console.error(
      "Please configure S3_BUCKET_NAME, S3_REGION, and AWS credentials in backend/.env before running migration."
    );
    return {
      success: false,
      total: 0,
      migrated: 0,
      alreadyExists: 0,
      skippedMissing: 0,
      failed: 0,
      reason: "S3_UNHEALTHY",
      details: s3Health.details,
    };
  }

  console.log(
    `[INFO] Target S3 Bucket: ${s3Provider.getBucketName()} (Region: ${s3Provider.getRegion()})`
  );

  // 2. Query all materials in PostgreSQL
  const allMaterials = await prisma.material.findMany({
    orderBy: { createdAt: "asc" },
  });

  const unmigratedMaterials = allMaterials.filter(
    (m) => !storageService.isS3Key(m.fileUrl || "")
  );

  console.log(
    `[INFO] Found ${allMaterials.length} total materials (${unmigratedMaterials.length} pending S3 migration).`
  );

  let migratedCount = 0;
  let alreadyExistsCount = 0;
  let skippedMissingCount = 0;
  let failedCount = 0;

  for (const material of unmigratedMaterials) {
    const rawKey = material.fileUrl || "";

    // 3. Resolve local file path on disk without synthetic fallback creation.
    // Migration source safety: Never synthesize placeholder/fallback PDFs during migration.
    const localPath = localProvider.resolveLocalPath(rawKey);

    if (!localPath || !fs.existsSync(localPath)) {
      console.warn(
        `[SKIP: LOCAL_MISSING] Source file missing on disk for material ${material.id} ("${material.title}"): ${rawKey || "[NO_URL]"}`
      );
      skippedMissingCount++;
      continue;
    }

    const localStats = fs.statSync(localPath);
    const localByteSize = localStats.size;

    if (localByteSize === 0) {
      console.warn(
        `[SKIP: LOCAL_EMPTY] Source file on disk is 0 bytes for material ${material.id}: ${localPath}`
      );
      skippedMissingCount++;
      continue;
    }

    const filename = path.basename(localPath);
    const targetS3Key = storageService.generateS3Key(
      material.courseId,
      material.id,
      filename
    );

    try {
      // 4. Idempotency Check (Byte-Size Match)
      // Checks whether the object already exists in S3 with identical byte-size.
      // Note: This validates byte-size equality for fast, safe resumption (not cryptographic content hash).
      const existsInS3 = await s3Provider.fileExists(targetS3Key);
      if (existsInS3) {
        const s3ByteSize = await s3Provider.getFileSize(targetS3Key);
        if (s3ByteSize === localByteSize) {
          console.log(
            `[ALREADY_EXISTS: BYTE_SIZE_MATCH] S3 object identical byte-size (${s3ByteSize} bytes): ${targetS3Key}`
          );

          if (material.fileUrl !== targetS3Key) {
            await prisma.material.update({
              where: { id: material.id },
              data: { fileUrl: targetS3Key },
            });
          }

          alreadyExistsCount++;
          continue;
        } else {
          console.log(
            `[SIZE_MISMATCH: RE-UPLOADING] Local size (${localByteSize} bytes) != S3 size (${s3ByteSize} bytes). Overwriting ${targetS3Key}...`
          );
        }
      }

      // 5. Upload buffer to S3
      console.log(
        `[UPLOADING] ${localPath} (${localByteSize} bytes) -> s3://${s3Provider.getBucketName()}/${targetS3Key}`
      );
      const fileBuffer = fs.readFileSync(localPath);
      await s3Provider.uploadFile(targetS3Key, fileBuffer, {
        contentType: "application/pdf",
        metadata: {
          materialId: material.id,
          courseId: material.courseId,
          originalTitle: encodeURIComponent(material.title),
        },
      });

      // 6. Post-Upload Verification via HeadObject
      const verified = await s3Provider.fileExists(targetS3Key);
      if (!verified) {
        throw new Error(
          `S3 HeadObject verification failed immediately following upload for key: ${targetS3Key}`
        );
      }

      // 7. Update PostgreSQL Material record
      await prisma.material.update({
        where: { id: material.id },
        data: { fileUrl: targetS3Key },
      });

      console.log(
        `[MIGRATED] Successfully updated DB: ${material.id} -> ${targetS3Key}`
      );
      migratedCount++;
    } catch (err: any) {
      console.error(
        `[MIGRATION FAILURE] Failed migrating material ${material.id}:`,
        err?.message || err
      );
      failedCount++;
    }
  }

  const isSuccess = failedCount === 0 && skippedMissingCount === 0;
  let reason: string | undefined = undefined;
  if (!isSuccess) {
    if (failedCount > 0) {
      reason = "FAILED_MIGRATIONS";
    } else if (skippedMissingCount > 0) {
      reason = "INCOMPLETE_SKIPPED_SOURCES";
    }
  }

  console.log("\n=================================================");
  console.log("Migration Summary Report:");
  console.log(`Total Materials Scanned:     ${allMaterials.length}`);
  console.log(`Newly Migrated to S3:       ${migratedCount}`);
  console.log(`Already Present (Size Match):${alreadyExistsCount}`);
  console.log(`Skipped (Missing on Disk):  ${skippedMissingCount}`);
  console.log(`Failed Migrations:          ${failedCount}`);
  console.log(`Status:                     ${isSuccess ? "COMPLETE" : "INCOMPLETE"}${reason ? ` (${reason})` : ""}`);
  console.log("Local backup files on disk: 100% preserved");
  console.log("=================================================\n");

  return {
    success: isSuccess,
    total: allMaterials.length,
    migrated: migratedCount,
    alreadyExists: alreadyExistsCount,
    skippedMissing: skippedMissingCount,
    failed: failedCount,
    reason,
  };
}

// Execute directly when run as CLI script
if (process.argv[1]?.includes("migrate-materials-to-s3")) {
  migrateMaterialsToS3()
    .then((result) => {
      if (!result.success) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("FATAL MIGRATION ERROR:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
