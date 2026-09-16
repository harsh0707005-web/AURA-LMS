import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { IStorageProvider, StorageFileStream, StorageUploadOptions } from "./storage.interface.js";

export class LocalStorageProvider implements IStorageProvider {
  readonly providerName = "local";
  readonly isCloud = false;
  private readonly uploadsDir: string;

  constructor(customDir?: string) {
    this.uploadsDir = customDir || path.resolve(process.cwd(), "uploads", "materials");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Resolves a storage key or relative path to a local filesystem path.
   * Returns null if path is an S3 cloud key or does not resolve safely.
   */
  public resolveLocalPath(key: string): string | null {
    if (!key) return null;

    // S3 cloud keys should not be resolved locally
    if (key.startsWith("materials/courses/")) {
      return null;
    }

    const filename = path.basename(key);
    const primaryCandidate = path.join(this.uploadsDir, filename);
    if (fs.existsSync(primaryCandidate)) {
      return primaryCandidate;
    }

    // Check direct relative path from workspace root
    const rootCandidate = path.resolve(process.cwd(), key.replace(/^\//, ""));
    if (fs.existsSync(rootCandidate) && fs.statSync(rootCandidate).isFile()) {
      return rootCandidate;
    }

    // Check public directory fallback
    const publicCandidate = path.resolve(process.cwd(), "public", key.replace(/^\//, ""));
    if (fs.existsSync(publicCandidate) && fs.statSync(publicCandidate).isFile()) {
      return publicCandidate;
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
    if (key.startsWith("materials/courses/")) {
      return;
    }

    const localPath = this.resolveLocalPath(key);
    if (localPath && fs.existsSync(localPath)) {
      try {
        await fs.promises.unlink(localPath);
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
