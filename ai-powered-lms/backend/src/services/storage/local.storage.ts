import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { IStorageProvider, StorageFileStream, StorageUploadOptions } from "./storage.interface.js";

/**
 * Checks whether a candidate path resolves within an approved root directory.
 * Prevents directory traversal (../, absolute escapes, and drive/UNC boundary crossings).
 */
export function isWithinRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);

  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export class LocalStorageProvider implements IStorageProvider {
  readonly providerName = "local";
  readonly isCloud = false;
  private readonly uploadsDir: string;
  private readonly publicDir: string;

  constructor(customDir?: string, customPublicDir?: string) {
    this.uploadsDir = path.resolve(customDir || path.resolve(process.cwd(), "uploads", "materials"));
    this.publicDir = path.resolve(customPublicDir || path.resolve(process.cwd(), "public"));
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
    if (!fs.existsSync(this.publicDir)) {
      fs.mkdirSync(this.publicDir, { recursive: true });
    }
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public getPublicDir(): string {
    return this.publicDir;
  }

  /**
   * Resolves a storage key or relative path to a local filesystem path.
   * Confines resolution strictly to approved storage roots (uploads/materials and public).
   * Returns null if path is an S3 cloud key, contains traversal attempts, or resolves outside approved roots.
   */
  public resolveLocalPath(key: string): string | null {
    if (!key || typeof key !== "string") return null;

    // S3 cloud keys must never be resolved locally
    if (key.startsWith("materials/courses/")) {
      return null;
    }

    // Reject null bytes
    if (key.includes("\0")) {
      return null;
    }

    const approvedRoots = [this.uploadsDir, this.publicDir];
    const hasTraversal = key.includes("..");
    const candidatePairs: Array<{ candidate: string; root: string }> = [];

    // 1. Candidate within uploadsDir (stripping optional /uploads/materials prefix)
    const uploadsPrefixRegex = /^\/?uploads\/materials\/?/;
    if (uploadsPrefixRegex.test(key)) {
      const rel = key.replace(uploadsPrefixRegex, "");
      candidatePairs.push({
        candidate: path.resolve(this.uploadsDir, rel),
        root: this.uploadsDir,
      });
    }

    // 2. Candidate within publicDir (stripping optional /public prefix)
    const publicPrefixRegex = /^\/?public\/?/;
    if (publicPrefixRegex.test(key)) {
      const rel = key.replace(publicPrefixRegex, "");
      candidatePairs.push({
        candidate: path.resolve(this.publicDir, rel),
        root: this.publicDir,
      });
    }

    // 3. Absolute filesystem paths (e.g. C:\... or explicit paths)
    if (path.isAbsolute(key)) {
      const resolved = path.resolve(key);
      for (const root of approvedRoots) {
        if (isWithinRoot(resolved, root)) {
          candidatePairs.push({
            candidate: resolved,
            root,
          });
        }
      }
    }

    // 4. Direct relative path within uploadsDir
    candidatePairs.push({
      candidate: path.resolve(this.uploadsDir, key.replace(/^\//, "")),
      root: this.uploadsDir,
    });

    // 5. Direct relative path within publicDir
    candidatePairs.push({
      candidate: path.resolve(this.publicDir, key.replace(/^\//, "")),
      root: this.publicDir,
    });

    // 6. Basename candidate within uploadsDir ONLY IF no traversal was attempted
    if (!hasTraversal) {
      const base = path.basename(key);
      candidatePairs.push({
        candidate: path.resolve(this.uploadsDir, base),
        root: this.uploadsDir,
      });
    }

    // Validate candidates in order against containment and existence
    for (const { candidate, root } of candidatePairs) {
      if (!isWithinRoot(candidate, root)) {
        continue;
      }

      if (fs.existsSync(candidate)) {
        try {
          const stat = fs.statSync(candidate);
          if (!stat.isFile()) continue;

          // Symlink traversal check
          const real = fs.realpathSync(candidate);
          if (isWithinRoot(real, root)) {
            return candidate;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  public async uploadFile(
    key: string,
    buffer: Buffer,
    _options?: StorageUploadOptions
  ): Promise<string> {
    const filename = path.basename(key);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const targetPath = path.join(this.uploadsDir, sanitizedFilename);

    await fs.promises.writeFile(targetPath, buffer);
    return `/uploads/materials/${sanitizedFilename}`;
  }

  public async getFileStream(key: string): Promise<StorageFileStream> {
    // If it's an S3 key, explicit 503 error as per specification
    if (key.startsWith("materials/courses/")) {
      throw Object.assign(
        new Error(
          "Material is stored in cloud S3, but S3 storage is currently disabled on this server."
        ),
        { statusCode: 503 }
      );
    }

    const localPath = this.resolveLocalPath(key);
    if (!localPath || !fs.existsSync(localPath)) {
      throw Object.assign(
        new Error(`Local file not found: ${key}`),
        { statusCode: 404 }
      );
    }

    const stat = await fs.promises.stat(localPath);
    const stream = fs.createReadStream(localPath);

    return {
      stream,
      contentLength: stat.size,
      contentType: "application/pdf",
    };
  }

  public async deleteFile(key: string): Promise<void> {
    if (!key || key.startsWith("materials/courses/")) {
      return;
    }

    const localPath = this.resolveLocalPath(key);
    if (localPath) {
      // Defense-in-depth: re-verify containment before unlinking
      const approvedRoots = [this.uploadsDir, this.publicDir];
      const isSafe = approvedRoots.some((root) => isWithinRoot(localPath, root));
      if (!isSafe) {
        return;
      }

      try {
        if (fs.existsSync(localPath)) {
          await fs.promises.unlink(localPath);
        }
      } catch (err) {
        // Idempotent: ignore deletion errors if file is already missing
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          throw err;
        }
      }
    }
  }

  public async fileExists(key: string): Promise<boolean> {
    if (key.startsWith("materials/courses/")) {
      return false;
    }
    const localPath = this.resolveLocalPath(key);
    return localPath !== null && fs.existsSync(localPath);
  }

  public async getFileSize(key: string): Promise<number> {
    const localPath = this.resolveLocalPath(key);
    if (!localPath || !fs.existsSync(localPath)) {
      throw Object.assign(
        new Error(`Local file not found: ${key}`),
        { statusCode: 404 }
      );
    }
    const stat = await fs.promises.stat(localPath);
    return stat.size;
  }

  public async getHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
      fs.accessSync(this.uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
      return {
        healthy: true,
        details: { directory: this.uploadsDir },
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: { directory: this.uploadsDir, error: error?.message },
      };
    }
  }
}
