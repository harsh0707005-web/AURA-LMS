import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { databaseEnvironment, parseDatabaseUrl, restoreTarget, backupDirectory } from "../lib/backup.js";
import { backupLocalStorage, copyVerifiedTree, verifyLocalBackup } from "../lib/local-backup.js";

test("backup connection decodes credentials but does not leak unrelated secrets or inherited libpq overrides", () => {
  const env = databaseEnvironment(parseDatabaseUrl("postgresql://test:p%40ss@localhost/test%20db?sslmode=verify-full&sslrootcert=cert.pem"), {
    PATH: "tools", PGHOSTADDR: "wrong-host", PGSERVICE: "production", JWT_SECRET: "private", DATABASE_URL: "private", GEMINI_API_KEY: "private",
  });
  assert.equal(env.PGHOST, "localhost");
  assert.equal(env.PGPASSWORD, "p@ss");
  assert.equal(env.PGDATABASE, "test db");
  assert.equal(env.PGSSLMODE, "verify-full");
  assert.equal(env.PGSSLROOTCERT, "cert.pem");
  for (const key of ["PGHOSTADDR", "PGSERVICE", "JWT_SECRET", "DATABASE_URL", "GEMINI_API_KEY"]) assert.equal(env[key], undefined);
});

test("backup connection errors hide invalid URLs and reject unknown options", () => {
  for (const url of ["not-a-url-private-token", "https://user:secret@localhost/db", "postgres://u:p@localhost/db?sslaccept=strict"]) {
    assert.throws(() => parseDatabaseUrl(url), error => error instanceof Error && !error.message.includes(url));
  }
});

test("restore refuses application database, remote hosts, unsafe names and missing targets", () => {
  const source = parseDatabaseUrl("postgres://test:test@localhost/aura_restore_live");
  for (const name of [undefined, "aura_restore_live", "production", "aura_restore_x;DROP", "aura_restore_"]) assert.throws(() => restoreTarget(source, name));
  assert.throws(() => restoreTarget(parseDatabaseUrl("postgres://test:test@remote.example/db"), "aura_restore_test"));
  assert.equal(restoreTarget(source, "aura_restore_test").pathname, "/aura_restore_test");
});

test("backups require an explicit directory outside the repository", async () => {
  await assert.rejects(backupDirectory("relative"));
  await assert.rejects(backupDirectory(process.cwd()));
});

test("local materials backup covers both storage roots, detects tampering and never overwrites", async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "aura-backup-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, "source");
  const base = path.join(temporary, "backups");
  await fs.mkdir(path.join(source, "uploads/materials"), { recursive: true });
  await fs.mkdir(path.join(source, "public"));
  await fs.mkdir(base);
  await fs.writeFile(path.join(source, "uploads/materials/test.pdf"), "%PDF-test");
  await fs.writeFile(path.join(source, "public/legacy.pdf"), "%PDF-legacy");
  const backup = await backupLocalStorage(base, source);
  assert.equal(backup.files, 2);
  await verifyLocalBackup(backup.directory);
  await assert.rejects(copyVerifiedTree(source, source));
  await assert.rejects(copyVerifiedTree(source, path.join(source, "nested")));
  const restored = path.join(base, "restored");
  await copyVerifiedTree(backup.directory, restored);
  await verifyLocalBackup(restored);
  await assert.rejects(copyVerifiedTree(backup.directory, restored));
  await fs.writeFile(path.join(restored, "public/legacy.pdf"), "modified");
  await assert.rejects(verifyLocalBackup(restored), /checksum/);
});
