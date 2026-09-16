import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { pipeline } from "stream/promises";
import prisma from "../lib/prisma.js";
import { storageService } from "../services/storage/storage.service.js";

export interface RestoreOptions {
  yes?: boolean;
  force?: boolean;
  dryRun?: boolean;
  customUploadsDir?: string;
  customS3Provider?: any;
  interactive?: boolean;
  materialIds?: string[];
}

export interface RestoreResult {
  success: boolean;
  total: number;
  restored: number;
  failed: number;
  reason?: string;
  details?: any;
  guidance?: string;
}

export function getRestoreGuidance(isFiltered: boolean): string {
  return isFiltered
    ? "NOTE: This run was scoped to specific material IDs. Do NOT set S3_ENABLED=false until an unfiltered restore reports SUCCESS."
    : "NEXT STEP: You may now safely set S3_ENABLED=false in your environment and restart the server.";
}

export async function restoreMaterialsFromS3(
  options?: RestoreOptions
): Promise<RestoreResult> {
  console.log("=================================================");
  console.log("AURA LMS: Reverse Migration (S3 to Local Rollback)");
  console.log("=================================================");

  const s3Provider =
    options?.customS3Provider || storageService.getS3StorageProvider();

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

  const uploadsDir =
    options?.customUploadsDir ||
    path.resolve(process.cwd(), "uploads", "materials");

  // 2. Query materials to restore from S3 (support optional materialIds filter)
  let targetMaterialIds = options?.materialIds;
  if (targetMaterialIds === undefined) {
    const idsArg = process.argv.find((arg) => arg.startsWith("--material-ids="));
    if (idsArg) {
      targetMaterialIds = idsArg
        .split("=")[1]
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const isFiltered = Array.isArray(targetMaterialIds);

  if (Array.isArray(targetMaterialIds) && targetMaterialIds.length === 0) {
    console.error(
      "[ROLLBACK ERROR] Empty material ID filter provided; refusing restore operation without modifying database or disk."
    );
    return {
      success: false,
      total: 0,
      restored: 0,
      failed: 0,
      reason: "EMPTY_MATERIAL_ID_FILTER",
    };
  }

  const whereClause: any = isFiltered && targetMaterialIds
    ? { id: { in: targetMaterialIds } }
    : {};

  const allMaterials = await prisma.material.findMany({
    where: whereClause,
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

  // 3. Dry-Run Handling
  const isDryRun =
    options?.dryRun || process.argv.includes("--dry-run");

  if (isDryRun) {
    console.log("\n[DRY RUN] Simulating restore operation without disk or database changes:");
    for (const m of s3Materials) {
      const rawFilename = path.basename(m.fileUrl!);
      const sanitizedName = rawFilename.endsWith(".pdf") ? rawFilename : `${rawFilename}.pdf`;
      const localFilename = `${m.id}-${sanitizedName}`;
      console.log(` - Material "${m.title}" (${m.id})`);
      console.log(`   Source S3:      ${m.fileUrl}`);
      console.log(`   Target Local:   ${path.join(uploadsDir, localFilename)}`);
      console.log(`   New fileUrl:    /uploads/materials/${localFilename}`);
    }
    console.log("[DRY RUN] Completed. No files were written and no database records were modified.\n");
    return {
      success: true,
      total: s3Materials.length,
      restored: 0,
      failed: 0,
      reason: "DRY_RUN",
    };
  }

  // 4. Explicit Confirmation Guard
  const isConfirmed =
    options?.yes ||
    options?.force ||
    process.argv.includes("--yes") ||
    process.argv.includes("-y") ||
    process.argv.includes("--force") ||
    process.argv.includes("-f");

  if (!isConfirmed) {
    const isInteractive =
      options?.interactive !== undefined
        ? options.interactive
        : Boolean(process.stdin.isTTY);

    if (isInteractive) {
      const answer = await new Promise<string>((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question(
          "\nCONFIRMATION REQUIRED: This will download all S3 materials to local disk and update database records.\nType 'yes' to proceed with rollback: ",
          (resp) => {
            rl.close();
            resolve(resp.trim().toLowerCase());
          }
        );
      });

      if (answer !== "yes" && answer !== "y") {
        console.log("Rollback aborted by user.");
        return {
          success: false,
          total: s3Materials.length,
          restored: 0,
          failed: 0,
          reason: "ABORTED_BY_USER",
        };
      }
    } else {
      console.error(
        "Non-interactive environment detected. Confirmation required: pass --yes or --force to proceed with restore."
      );
      return {
        success: false,
        total: s3Materials.length,
        restored: 0,
        failed: 0,
        reason: "CONFIRMATION_REQUIRED",
      };
    }
  }

  // 5. Execute Reverse Migration
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

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

      // Download stream from S3 and capture expected content length
      const fileStream = await s3Provider.getFileStream(s3Key);
      const expectedSize = fileStream.contentLength;

      const writeStream = fs.createWriteStream(targetLocalPath);
      await pipeline(fileStream.stream, writeStream);

      // Verification Check: file exists, is not empty, and size matches S3 ContentLength
      if (!fs.existsSync(targetLocalPath)) {
        throw new Error(
          `Downloaded file was not found on disk at: ${targetLocalPath}`
        );
      }

      const localStats = fs.statSync(targetLocalPath);
      const downloadedSize = localStats.size;

      if (downloadedSize === 0) {
        if (fs.existsSync(targetLocalPath)) {
          fs.unlinkSync(targetLocalPath);
        }
        throw new Error(
          `Downloaded file is 0 bytes (empty) at: ${targetLocalPath}`
        );
      }

      if (!Number.isSafeInteger(expectedSize) || (expectedSize as number) <= 0) {
        if (fs.existsSync(targetLocalPath)) {
          fs.unlinkSync(targetLocalPath);
        }
        throw new Error(`S3 ContentLength is missing or invalid for ${s3Key}`);
      }

      if (downloadedSize !== expectedSize) {
        if (fs.existsSync(targetLocalPath)) {
          fs.unlinkSync(targetLocalPath);
        }
        throw new Error(
          `Byte-size mismatch for ${s3Key}: expected ${expectedSize} bytes from S3, but received ${downloadedSize} bytes`
        );
      }

      // Update PostgreSQL record ONLY after successful verification
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

  let guidance: string | undefined;
  if (isFullSuccess) {
    console.log("STATUS: SUCCESS");
    console.log("All targeted S3 materials have been verified and restored to local disk.");
    guidance = getRestoreGuidance(isFiltered);
    console.log(guidance);
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
    guidance,
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
