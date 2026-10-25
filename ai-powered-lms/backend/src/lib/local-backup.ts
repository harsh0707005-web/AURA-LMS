import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sha256, within } from "./backup.js";

interface FileRecord { path: string; bytes: number; sha256: string }

export async function fileInventory(root: string): Promise<FileRecord[]> {
  const result: FileRecord[] = [];
  async function visit(directory: string): Promise<void> {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Backup roots must be real directories.");
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error("Symlinks are not supported in local backups.");
      if (item.isDirectory()) await visit(file);
      else if (item.isFile()) result.push({ path: path.relative(root, file).split(path.sep).join("/"), bytes: (await fs.stat(file)).size, sha256: await sha256(file) });
      else throw new Error("Unsupported file type in backup root.");
    }
  }
  await visit(root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

/** Copy to a new location; never merge with or overwrite an existing directory. */
export async function copyVerifiedTree(source: string, destination: string): Promise<number> {
  const realSource = await fs.realpath(source);
  const realParent = await fs.realpath(path.dirname(destination));
  if (within(path.join(realParent, path.basename(destination)), realSource)) throw new Error("Backup destination cannot be inside the source.");
  const before = await fileInventory(source);
  await fs.mkdir(destination, { mode: 0o700 });
  for (const entry of await fs.readdir(source)) {
    await fs.cp(path.join(source, entry), path.join(destination, entry), { recursive: true, force: false, errorOnExist: true, dereference: false });
  }
  const copied = await fileInventory(destination);
  const after = await fileInventory(source);
  if (JSON.stringify(before) !== JSON.stringify(copied) || JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("File verification failed or source changed during backup; retry while application writes are stopped.");
  }
  return copied.length;
}

export async function backupLocalStorage(base: string, backendRoot: string): Promise<{ directory: string; files: number }> {
  const directory = path.join(base, `materials-${randomUUID()}`);
  await fs.mkdir(directory, { mode: 0o700 });
  let files = 0;
  for (const relative of ["uploads/materials", "public"]) {
    const source = path.join(backendRoot, relative);
    try { await fs.access(source); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && relative === "public") continue;
      throw error;
    }
    const destination = path.join(directory, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    files += await copyVerifiedTree(source, destination);
  }
  // Written last: absent manifest means an incomplete backup. Contains filenames, so keep private.
  const manifest = { version: 1, completedAt: new Date().toISOString(), files: await fileInventory(directory) };
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  return { directory, files };
}

export async function verifyLocalBackup(directory: string): Promise<void> {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8"));
  if (manifest.version !== 1 || !Array.isArray(manifest.files)) throw new Error("Invalid local backup manifest.");
  const actual = (await fileInventory(directory)).filter(file => file.path !== "manifest.json");
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files)) throw new Error("Local backup checksum mismatch.");
}
