import path from "path";
import { IStorageProvider, StorageFileStream, StorageUploadOptions } from "./storage.interface.js";
import { LocalStorageProvider } from "./local.storage.js";
import { S3StorageProvider } from "./s3.storage.js";

export class StorageService {
  private localProvider: LocalStorageProvider;
  private s3Provider: S3StorageProvider;

  constructor(localProvider?: LocalStorageProvider, s3Provider?: S3StorageProvider) {
    this.localProvider = localProvider || new LocalStorageProvider();
    this.s3Provider = s3Provider || new S3StorageProvider();
  }

  public isS3Enabled(): boolean {
    return process.env.S3_ENABLED === "true";
  }

  public isS3Key(keyOrPath: string): boolean {
    if (!keyOrPath) return false;
    return keyOrPath.startsWith("materials/courses/");
  }

  public isLocalKey(keyOrPath: string): boolean {
    return !this.isS3Key(keyOrPath);
  }

  public getActiveProviderName(): string {
    return this.isS3Enabled() ? "s3" : "local";
  }

  public getActiveProvider(): IStorageProvider {
    return this.isS3Enabled() ? this.s3Provider : this.localProvider;
  }

  public getLocalStorageProvider(): LocalStorageProvider {
    return this.localProvider;
  }

  public getS3StorageProvider(): S3StorageProvider {
    return this.s3Provider;
  }

  public setS3StorageProvider(provider: S3StorageProvider): void {
    this.s3Provider = provider;
  }

  public setLocalStorageProvider(provider: LocalStorageProvider): void {
    this.localProvider = provider;
  }

  /**
   * Generates a canonical S3 storage object key for a course material.
   * Format: materials/courses/{courseId}/{materialId}/{sanitizedFilename}.pdf
   */
  public generateS3Key(courseId: string, materialId: string, originalFilename: string): string {
    const ext = path.extname(originalFilename).toLowerCase() || ".pdf";
    const base = path.basename(originalFilename, ext);
    const sanitizedBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `materials/courses/${courseId}/${materialId}/${sanitizedBase}${ext}`;
  }

  /**
   * Uploads a material file buffer to the active storage provider.
   * If S3_ENABLED=true, uploads to S3.
   * If S3_ENABLED=false, saves to local disk.
   */
  public async uploadMaterial(
    courseId: string,
    materialId: string,
    filename: string,
    buffer: Buffer,
    options?: StorageUploadOptions
  ): Promise<string> {
    if (this.isS3Enabled()) {
      const s3Key = this.generateS3Key(courseId, materialId, filename);
      return await this.s3Provider.uploadFile(s3Key, buffer, options);
    } else {
      const sanitizedFilename = `${materialId}-${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      return await this.localProvider.uploadFile(sanitizedFilename, buffer, options);
    }
  }

  /**
   * Streams a file from storage based on its key format and active provider.
   * If S3_ENABLED=false and key is an S3 object key, rejects with HTTP 503.
   */
  public async getFileStream(keyOrPath: string): Promise<StorageFileStream> {
    if (!keyOrPath) {
      throw Object.assign(new Error("File storage key is required"), { statusCode: 400 });
    }

    if (this.isS3Key(keyOrPath)) {
      if (!this.isS3Enabled()) {
        throw Object.assign(
          new Error(
            "Material is stored in cloud S3, but S3 storage is currently disabled on this server."
          ),
          { statusCode: 503 }
        );
      }
      return await this.s3Provider.getFileStream(keyOrPath);
    }

    // Local file path (legacy or offline mode)
    return await this.localProvider.getFileStream(keyOrPath);
  }

  /**
   * Deletes a file from storage.
   * Idempotent operation: does not throw if file does not exist.
   * If S3_ENABLED=true and S3 bucket is unconfigured, propagates 503.
   */
  public async deleteFile(keyOrPath: string): Promise<void> {
    if (!keyOrPath) return;

    if (this.isS3Key(keyOrPath)) {
      if (!this.isS3Enabled()) {
        throw Object.assign(
          new Error(
            "Material is stored in cloud S3, but S3 storage is currently disabled on this server."
          ),
          { statusCode: 503 }
        );
      }
      await this.s3Provider.deleteFile(keyOrPath);
      return;
    }

    await this.localProvider.deleteFile(keyOrPath);
  }

  /**
   * Checks if a file exists in the respective storage provider.
   */
  public async fileExists(keyOrPath: string): Promise<boolean> {
    if (!keyOrPath) return false;

    if (this.isS3Key(keyOrPath)) {
      if (!this.isS3Enabled()) {
        return false;
      }
      return await this.s3Provider.fileExists(keyOrPath);
    }

    return await this.localProvider.fileExists(keyOrPath);
  }

  /**
   * Gets storage provider health status.
   */
  public async getHealth(): Promise<{
    provider: string;
    healthy: boolean;
    details?: any;
  }> {
    const activeProvider = this.getActiveProvider();
    const health = await activeProvider.getHealth();
    return {
      provider: activeProvider.providerName,
      healthy: health.healthy,
      details: health.details,
    };
  }
}

export const storageService = new StorageService();
