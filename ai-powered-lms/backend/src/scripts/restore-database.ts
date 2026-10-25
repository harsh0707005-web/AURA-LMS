import "dotenv/config";
import { parseDatabaseUrl, restoreDatabase } from "../lib/backup.js";

async function run(): Promise<void> {
  const backupFile = process.env.BACKUP_FILE;
  if (!backupFile) throw new Error("BACKUP_FILE must point to a .dump file");
  if (process.env.CONFIRM_RESTORE !== "YES") {
    throw new Error("Restore is blocked by default. Set CONFIRM_RESTORE=YES after verifying the target database.");
  }

  if (process.env.RESTORE_CLEAN) throw new Error("RESTORE_CLEAN is not supported. Use a new empty test database.");
  await restoreDatabase(backupFile, parseDatabaseUrl(process.env.DATABASE_URL), process.env.RESTORE_DATABASE_NAME);
  console.log("Restore into isolated local database complete. Application DATABASE_URL was not changed.");
}

run().catch((error: unknown) => {
  console.error("[RESTORE_FAILED] Check confirmation, checksum, and an empty local aura_restore_ target. Application database must not be the target. Raw diagnostics withheld.");
  process.exitCode = 1;
});
