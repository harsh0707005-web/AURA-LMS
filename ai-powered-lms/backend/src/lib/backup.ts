import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

export function parseDatabaseUrl(value: string | undefined): URL {
  try {
    const url = new URL(value || "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2 || url.hash) throw new Error();
    // Do not silently drop connection-security options when invoking libpq.
    const allowed = ["sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout", "schema"];
    for (const key of url.searchParams.keys()) if (!allowed.includes(key)) throw new Error();
    if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") throw new Error();
    decodeURIComponent(url.password);
    decodeURIComponent(url.username);
    decodeURIComponent(url.pathname.slice(1));
    return url;
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL with supported connection options (value withheld).");
  }
}

export function databaseEnvironment(url: URL, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base };
  // Clear inherited libpq overrides, including services and hostaddr.
  for (const key of Object.keys(env)) if (key.startsWith("PG") || /(?:KEY|SECRET|TOKEN|DATABASE_URL|PASSWORD)/i.test(key)) delete env[key];
  Object.assign(env, {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""), PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: "10",
  });
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout"]) {
    if (url.searchParams.has(key)) env[`PG${key.toUpperCase()}`] = url.searchParams.get(key)!;
  }
  return env;
}

export async function runPg(tool: "pg_dump" | "pg_restore", args: string[], url: URL): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(tool, args, { env: databaseEnvironment(url), stdio: ["ignore", "ignore", "pipe"], timeout: 300_000 });
    let warned = false;
    // Database errors can contain SQL, credentials or student data. Never echo raw stderr.
    child.stderr.on("data", () => { warned = true; });
    child.once("error", () => reject(new Error(`${tool} could not start or timed out; check PostgreSQL client tools and connectivity.`)));
    child.once("close", (code) => {
      if (code !== 0) reject(new Error(`${tool} failed (exit ${code ?? "signal"}); raw diagnostics withheld.`));
      else if (warned) reject(new Error(`${tool} produced diagnostics; backup/restore requires private operator review before acceptance.`));
      else resolve();
    });
  });
}

export async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function within(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export async function backupDirectory(value = process.env.BACKUP_DIR): Promise<string> {
  if (!value || !path.isAbsolute(value)) throw new Error("Set BACKUP_DIR to an existing absolute private directory outside the Git repository.");
  const directory = await fs.realpath(value);
  let current = await fs.realpath(process.cwd());
  while (true) {
    try {
      await fs.stat(path.join(current, ".git"));
      if (within(directory, current)) throw new Error("Backup output must be outside the Git repository.");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!(await fs.stat(directory)).isDirectory()) throw new Error("BACKUP_DIR is not a directory.");
  return directory;
}

export function restoreTarget(source: URL, name: string | undefined): URL {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname)) throw new Error("This restore command is limited to local restore drills.");
  if (!name || !/^aura_restore_[a-z0-9_]{1,40}$/.test(name)) throw new Error("RESTORE_DATABASE_NAME must start with aura_restore_ and contain only lowercase letters, digits and underscores.");
  if (name === decodeURIComponent(source.pathname.slice(1))) throw new Error("Refusing to restore into the application database.");
  const target = new URL(source);
  target.pathname = `/${name}`;
  return target;
}

export async function restoreDatabase(file: string, source: URL, name: string | undefined): Promise<void> {
  const target = restoreTarget(source, name);
  const expected = (await fs.readFile(`${file}.sha256`, "utf8")).trim();
  if (!/^[a-f0-9]{64}$/.test(expected) || expected !== await sha256(file)) throw new Error("Backup checksum verification failed.");
  const client = new Client({ connectionString: target.toString(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const objects = await client.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'");
    if (objects.rows[0].count !== 0) throw new Error("Restore target is not empty; no objects were modified.");
  } finally { await client.end(); }
  await runPg("pg_restore", ["--dbname", name!, "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", path.resolve(file)], target);
}
