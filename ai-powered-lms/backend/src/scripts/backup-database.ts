import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { backupDirectory, parseDatabaseUrl, runPg, sha256 } from "../lib/backup.js";

async function run(): Promise<void> {
  const url = parseDatabaseUrl(process.env.DATABASE_URL);
  const outputDirectory = await backupDirectory();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(outputDirectory, `aura-lms-${timestamp}-${randomUUID()}.dump`);
  const partial = `${outputFile}.partial`;
  const handle = await fs.open(partial, "wx", 0o600);
  await handle.close();

  await runPg("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--no-password", "--file", partial], url);
  const stat = await fs.stat(partial);
  if (stat.size === 0) throw new Error("pg_dump produced an empty backup");
  await runPg("pg_restore", ["--list", partial], url);
  await fs.writeFile(`${outputFile}.sha256`, `${await sha256(partial)}\n`, { flag: "wx", mode: 0o600 });
  await fs.rename(partial, outputFile);
  console.log(`Backup complete (${stat.size} bytes): ${outputFile}`);
}

run().catch((error: unknown) => {
  console.error("[BACKUP_FAILED] Check BACKUP_DIR, database connectivity and PostgreSQL tools. Any .partial file is incomplete. Raw diagnostics withheld.");
  process.exitCode = 1;
});
