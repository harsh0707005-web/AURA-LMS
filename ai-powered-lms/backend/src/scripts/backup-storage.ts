import "dotenv/config";
import { CopyObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { storageService } from "../services/storage/storage.service.js";
import { backupDirectory } from "../lib/backup.js";
import { backupLocalStorage } from "../lib/local-backup.js";
import { randomUUID } from "node:crypto";

async function run(): Promise<void> {
  if (process.env.S3_ENABLED !== "true") {
    const backup = await backupLocalStorage(await backupDirectory(), process.cwd());
    console.log(`Local storage backup verified: ${backup.files} files in ${backup.directory}`);
    return;
  }

  const source = storageService.getS3StorageProvider();
  const sourceBucket = source.getBucketName();
  const backupBucket = process.env.BACKUP_S3_BUCKET?.trim();
  const basePrefix = (process.env.BACKUP_S3_PREFIX || "backups/materials").replace(/\/+$/, "");
  if (!basePrefix || basePrefix.startsWith("/") || basePrefix.split("/").includes("..")) throw new Error("Invalid backup prefix");
  const prefix = `${basePrefix}/${randomUUID()}`;
  if (!sourceBucket || !backupBucket || backupBucket === sourceBucket) throw new Error("Set a separate BACKUP_S3_BUCKET; same-bucket backups are refused");

  let continuationToken: string | undefined;
  let copied = 0;
  do {
    const page = await source.getS3Client().send(new ListObjectsV2Command({
      Bucket: sourceBucket,
      Prefix: "materials/courses/",
      ContinuationToken: continuationToken,
    }));
    for (const object of page.Contents || []) {
      if (!object.Key) continue;
      const destinationKey = `${prefix}/${object.Key}`;
      await source.getS3Client().send(new CopyObjectCommand({
        Bucket: backupBucket,
        Key: destinationKey,
        CopySource: `${sourceBucket}/${encodeURIComponent(object.Key).replace(/%2F/g, "/")}`,
        MetadataDirective: "COPY",
      }));
      copied += 1;
    }
    if (page.IsTruncated && !page.NextContinuationToken) throw new Error("Incomplete storage listing");
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`Storage backup complete: ${copied} material object(s) copied to s3://${backupBucket}/${prefix}/`);
}

run().catch((error: unknown) => {
  console.error("[STORAGE_BACKUP_FAILED] Check private BACKUP_DIR or separate S3 backup bucket permissions. Raw diagnostics withheld.");
  process.exitCode = 1;
});
