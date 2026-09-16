import "dotenv/config";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import prisma from "../lib/prisma.js";
import { storageService } from "../services/storage/storage.service.js";

export interface RestoreResult {
  success: boolean;
  total: number;
  restored: number;
  failed: number;
  reason?: string;
  details?: any;
}

export async function restoreMaterialsFromS3(): Promise<RestoreResult> {
  console.log("=================================================");
  console.log("AURA LMS: Reverse Migration (S3 to Local Rollback)");
  console.log("=================================================");

  const s3Provider = storageService.getS3StorageProvider();

  // 1. Verify S3 configuration and connectivity
  const s3Health = await s3Provider.getHealth();
  if (!s3Health.healthy) {
    console.error(
      `[ROLLBACK ERROR] Cannot connect to S3 to download objects:`,
      s3Health.details
    );
    return {
      success: false,
      total: 0,
      restored: 0,
      failed: 0,
      reason: "S3_UNHEALTHY",
      details: s3Health.details,
    };
  }

  const uploadsDir = path.resolve(process.cwd(), "uploads", "materials");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 2. Query all materials stored in S3
  const allMaterials = await prisma.material.findMany({
    orderBy: { createdAt: "asc" },
  });

  const s3Materials = allMaterials.filter(
    (m) => m.fileUrl && storageService.isS3Key(m.fileUrl)
  );

  console.log(
    `[INFO] Target S3 Bucket: ${s3Provider.getBucketName()} (${s3Provider.getRegion()})`
  );
  console.log(
    `[INFO] Found ${s3Materials.length} materials currently hosted on S3 to restore.`
  );

  let restoredCount = 0;
  let failedCount = 0;

  for (const material of s3Materials) {
    const s3Key = material.fileUrl!;
    const rawFilename = path.basename(s3Key);
    const sanitizedName = rawFilename.endsWith(".pdf")
      ? rawFilename
      : `${rawFilename}.pdf`;
    const localFilename = `${material.id}-${sanitizedName}`;
    const targetLocalPath = path.join(uploadsDir, localFilename);

    try {
      console.log(
        `[DOWNLOADING] s3://${s3Provider.getBucketName()}/${s3Key} -> ${targetLocalPath}`
      );

      // 3. Download stream from S3 and capture expected content length
      const fileStream = await s3Provider.getFileStream(s3Key);
      const expectedSize = fileStream.contentLength;

      const writeStream = fs.createWriteStream(targetLocalPath);
      await pipeline(fileStream.stream, writeStream);

      // 4. Verification Check: file exists, is not empty, and size matches S3 ContentLength
      if (!fs.existsSync(targetLocalPath)) {
        throw new Error(
          `Downloaded file was not found on disk at: ${targetLocalPath}`
        );
      }

      const localStats = fs.statSync(targetLocalPath);
      const downloadedSize = localStats.size;

      if (downloadedSize === 0) {
        fs.unlinkSync(targetLocalPath);
        throw new Error(
          `Downloaded file is 0 bytes (empty) at: ${targetLocalPath}`
        );
      }

      if (
        expectedSize !== undefined &&
        expectedSize > 0 &&
        downloadedSize !== expectedSize
      ) {
        fs.unlinkSync(targetLocalPath);
        throw new Error(
          `Byte-size mismatch for ${s3Key}: expected ${expectedSize} bytes from S3, but received ${downloadedSize} bytes`
        );
      }

      // 5. Update PostgreSQL record ONLY after successful verification
      const localUrl = `/uploads/materials/${localFilename}`;
      await prisma.material.update({
        where: { id: material.id },
        data: { fileUrl: localUrl },
      });

      console.log(
        `[RESTORED] Verified ${downloadedSize} bytes. Updated DB: ${material.id} -> ${localUrl}`
      );
      restoredCount++;
    } catch (err: any) {
      console.error(
        `[RESTORE FAILURE] Failed to restore material ${material.id} (${s3Key}):`,
        err?.message || err
      );

      // Ensure partial or corrupted files are removed
      if (fs.existsSync(targetLocalPath)) {
        try {
          fs.unlinkSync(targetLocalPath);
        } catch {}
      }

      failedCount++;
    }
  }

  // 6. Rollback Safety Assessment
  const isFullSuccess =
    failedCount === 0 &&
    (s3Materials.length === 0 || restoredCount === s3Materials.length);

  console.log("\n=================================================");
  console.log("Reverse Migration Summary Report:");
  console.log(`Total S3 Objects Targeted:  ${s3Materials.length}`);
  console.log(`Successfully Restored:       ${restoredCount}`);
  console.log(`Failed Restorations:         ${failedCount}`);
  console.log(`Local Storage Directory:     ${uploadsDir}`);

  if (isFullSuccess) {
    console.log("STATUS: SUCCESS");
    console.log("All targeted S3 materials have been verified and restored to local disk.");
    console.log("NEXT STEP: You may now safely set S3_ENABLED=false in your environment and restart the server.");
  } else {
    console.error("STATUS: INCOMPLETE / UNSAFE");
    console.error(`CRITICAL: ${failedCount} material(s) failed restoration or verification.`);
    console.error("S3_ENABLED MUST REMAIN 'true' to prevent broken access to un-restored materials.");
    console.error("Do NOT set S3_ENABLED=false until all failed materials have been addressed.");
  }
  console.log("=================================================\n");

  return {
    success: isFullSuccess,
    total: s3Materials.length,
    restored: restoredCount,
    failed: failedCount,
  };
}

// Execute directly when run as CLI script
if (process.argv[1]?.includes("restore-materials-from-s3")) {
  restoreMaterialsFromS3()
    .then((result) => {
      if (!result.success) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("FATAL ROLLBACK ERROR:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
