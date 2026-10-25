import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { backupDirectory, parseDatabaseUrl, restoreDatabase, restoreTarget } from "../lib/backup.js";
import { copyVerifiedTree, verifyLocalBackup } from "../lib/local-backup.js";
import { LocalStorageProvider } from "../services/storage/local.storage.js";

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

async function counts(client: Client): Promise<Record<string, string>> {
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result: Record<string, string> = {};
  for (const { tablename } of tables.rows) {
    result[tablename] = (await client.query(`SELECT count(*)::text AS count FROM public.${quote(tablename)}`)).rows[0].count;
  }
  return result;
}

async function run(): Promise<void> {
  if (process.env.CONFIRM_LOCAL_DRILL !== "YES") throw new Error("Set CONFIRM_LOCAL_DRILL=YES to create a new local test database.");
  if (process.env.S3_ENABLED === "true") throw new Error("This drill supports local file storage only.");
  const sourceUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  const name = `aura_restore_${randomUUID().replaceAll("-", "")}`;
  const targetUrl = restoreTarget(sourceUrl, name);
  const file = process.env.BACKUP_FILE;
  const storageBackup = process.env.STORAGE_BACKUP_DIR;
  if (!file || !storageBackup) throw new Error("BACKUP_FILE and STORAGE_BACKUP_DIR are required.");
  await verifyLocalBackup(storageBackup);
  const base = await backupDirectory();
  const restoredFiles = path.join(base, `${name}_files`);
  await copyVerifiedTree(storageBackup, restoredFiles);
  await verifyLocalBackup(restoredFiles);

  const source = new Client({ connectionString: sourceUrl.toString(), connectionTimeoutMillis: 5000 });
  const target = new Client({ connectionString: targetUrl.toString(), connectionTimeoutMillis: 5000 });
  try {
    await source.connect();
    const baseline = await counts(source);
    // The name is generated above, never user SQL. CREATE fails if a database exists.
    await source.query(`CREATE DATABASE ${quote(name)} TEMPLATE template0`);
    console.log(`Created isolated restore database: ${name}`);
    await restoreDatabase(file, sourceUrl, name);
    await target.connect();
    const restored = await counts(target);
    const after = await counts(source);
    const rowCountsMatch = JSON.stringify(baseline) === JSON.stringify(restored) && JSON.stringify(baseline) === JSON.stringify(after);
    const vectorInstalled = (await target.query("SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='vector') AS installed")).rows[0].installed === true;
    const storage = new LocalStorageProvider(path.join(restoredFiles, "uploads/materials"), path.join(restoredFiles, "public"));
    let referencesChecked = 0;
    let unavailableReferences = 0;
    for (const table of ["Material", "Document"]) {
      if (!(table in restored)) continue;
      const records = await target.query(`SELECT "fileUrl" FROM ${quote(table)} WHERE "fileUrl" IS NOT NULL`);
      for (const { fileUrl } of records.rows) {
        referencesChecked += 1;
        if (!await storage.fileExists(fileUrl)) unavailableReferences += 1;
      }
    }
    // Do not leave a test copy with usable copied reset/verification/refresh sessions.
    for (const [table, field] of [["RefreshSession", "revokedAt"], ["PasswordResetToken", "usedAt"], ["EmailVerificationToken", "usedAt"]]) {
      if (table in restored) await target.query(`UPDATE ${quote(table)} SET ${quote(field)}=CURRENT_TIMESTAMP WHERE ${quote(field)} IS NULL`);
    }
    const report = {
      checkedAt: new Date().toISOString(), database: name, tablesChecked: Object.keys(restored).length,
      rowCountsMatch, vectorInstalled, fileChecksumsMatch: true, referencesChecked, unavailableReferences,
      copiedSessionsInvalidated: true, sourceDatabaseModified: false,
      note: "Local restore drill only. No mail delivery, browser login, off-machine durability or coordinated point-in-time snapshot proved. Test database and files retained for private review.",
    };
    await fs.writeFile(path.join(base, `${name}_receipt.json`), JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
    if (!rowCountsMatch || !vectorInstalled || unavailableReferences > 0) process.exitCode = 1;
  } finally {
    await source.end();
    await target.end();
  }
}

run().catch(() => {
  console.error("[RESTORE_DRILL_FAILED] Check private backup/checksum, local database create permission, and pgvector. Any newly created test database is retained. Raw diagnostics withheld.");
  process.exitCode = 1;
});
