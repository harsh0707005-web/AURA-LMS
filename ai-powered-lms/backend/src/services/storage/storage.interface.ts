import { Readable } from "stream";

export interface StorageUploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface StorageFileStream {
  stream: Readable;
  contentLength?: number;
  contentType: string;
}

export interface IStorageProvider {
  readonly providerName: string;
  readonly isCloud: boolean;
  uploadFile(key: string, buffer: Buffer, options?: StorageUploadOptions): Promise<string>;
  getFileStream(key: string): Promise<StorageFileStream>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
  getFileSize(key: string): Promise<number>;
  getHealth(): Promise<{ healthy: boolean; details?: any }>;
}
