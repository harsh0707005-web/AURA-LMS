import { Readable } from "stream";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import {
  IStorageProvider,
  StorageFileStream,
  StorageUploadOptions,
} from "./storage.interface.js";

export interface S3StorageConfig {
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  deliveryMode?: string;
  client?: S3Client;
}

export class S3StorageProvider implements IStorageProvider {
  readonly providerName = "s3";
  readonly isCloud = true;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;
  private readonly deliveryMode: string;

  constructor(config?: S3StorageConfig) {
    // Canonical environment variable naming scheme
    this.region =
      config?.region ||
      process.env.S3_REGION ||
      "us-east-1";

    this.bucket =
      config?.bucket ||
      process.env.S3_BUCKET_NAME ||
      "";

    this.endpoint =
      config?.endpoint ||
      process.env.S3_ENDPOINT ||
      undefined;

    this.forcePathStyle =
      config?.forcePathStyle !== undefined
        ? config.forcePathStyle
        : process.env.S3_FORCE_PATH_STYLE === "true";

    this.deliveryMode =
      config?.deliveryMode ||
      process.env.S3_DELIVERY_MODE ||
      "proxy";

    if (config?.client) {
      this.client = config.client;
    } else {
      const accessKeyId =
        config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey =
        config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

      const clientConfig: any = {
        region: this.region,
      };

      if (this.endpoint) {
        clientConfig.endpoint = this.endpoint;
      }

      if (this.forcePathStyle) {
        clientConfig.forcePathStyle = true;
      }

      // If explicit credentials are provided, use them;
      // otherwise, let AWS SDK resolve credentials automatically via the default credential provider chain.
      if (accessKeyId && secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId,
          secretAccessKey,
        };
      }

      this.client = new S3Client(clientConfig);
    }
  }

  public getBucketName(): string {
    return this.bucket;
  }

  public getRegion(): string {
    return this.region;
  }

  public getEndpoint(): string | undefined {
    return this.endpoint;
  }

  public getForcePathStyle(): boolean {
    return this.forcePathStyle;
  }

  public getDeliveryMode(): string {
    return this.deliveryMode;
  }

  public getS3Client(): S3Client {
    return this.client;
  }

  public async uploadFile(
    key: string,
    buffer: Buffer,
    options?: StorageUploadOptions
  ): Promise<string> {
    if (!this.bucket) {
      throw Object.assign(
        new Error("Cloud storage service unavailable: S3 bucket is not configured."),
        { statusCode: 503 }
      );
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: options?.contentType || "application/pdf",
          Metadata: options?.metadata,
        })
      );
      return key;
    } catch (error: any) {
      const err = Object.assign(
        new Error("Cloud storage service unavailable. Upload aborted."),
        { statusCode: 503, cause: error }
      );
      throw err;
    }
  }

  public async getFileStream(key: string): Promise<StorageFileStream> {
    if (!this.bucket) {
      throw Object.assign(
        new Error("Cloud storage service unavailable: S3 bucket is not configured."),
        { statusCode: 503 }
      );
    }

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) {
        throw Object.assign(
          new Error(`S3 object not found: ${key}`),
          { statusCode: 404 }
        );
      }

      let stream: Readable;
      if (typeof (response.Body as any).pipe === "function") {
        stream = response.Body as Readable;
      } else if (typeof (response.Body as any).transformToWebStream === "function") {
        const webStream = (response.Body as any).transformToWebStream();
        stream = Readable.fromWeb(webStream as any);
      } else {
        stream = Readable.from(response.Body as any);
      }

      return {
        stream,
        contentLength: response.ContentLength,
        contentType: response.ContentType || "application/pdf",
      };
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404 ||
        error.statusCode === 404
      ) {
        throw Object.assign(
          new Error(`S3 object not found: ${key}`),
          { statusCode: 404 }
        );
      }

      throw Object.assign(
        new Error(`Failed to retrieve file from cloud storage: ${error?.message || "Unknown S3 error"}`),
        { statusCode: 503, cause: error }
      );
    }
  }

  public async deleteFile(key: string): Promise<void> {
    // If S3 bucket is not configured, throw 503 instead of silently succeeding
    if (!this.bucket) {
      throw Object.assign(
        new Error("Cloud storage service unavailable: S3 bucket is not configured."),
        { statusCode: 503 }
      );
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (error: any) {
      // Idempotent: 404 or NoSuchKey is considered already deleted (success)
      if (
        error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404 ||
        error.statusCode === 404
      ) {
        return;
      }

      throw Object.assign(
        new Error(`Failed to delete object from cloud storage: ${error?.message || "Unknown error"}`),
        { statusCode: 503, cause: error }
      );
    }
  }

  public async fileExists(key: string): Promise<boolean> {
    if (!this.bucket) {
      throw Object.assign(
        new Error("Cloud storage service unavailable: S3 bucket is not configured."),
        { statusCode: 503 }
      );
    }

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404 ||
        error.statusCode === 404
      ) {
        return false;
      }
      throw Object.assign(
        new Error(`Failed to check object existence in cloud storage: ${error?.message || "Unknown error"}`),
        { statusCode: 503, cause: error }
      );
    }
  }

  public async getFileSize(key: string): Promise<number> {
    if (!this.bucket) {
      throw Object.assign(
        new Error("Cloud storage service unavailable: S3 bucket is not configured."),
        { statusCode: 503 }
      );
    }

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return response.ContentLength || 0;
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.name === "NotFound" ||
        error.$metadata?.httpStatusCode === 404 ||
        error.statusCode === 404
      ) {
        throw Object.assign(
          new Error(`S3 object not found: ${key}`),
          { statusCode: 404 }
        );
      }
      throw Object.assign(
        new Error(`Failed to get object metadata from cloud storage: ${error?.message || "Unknown error"}`),
        { statusCode: 503, cause: error }
      );
    }
  }

  public async getHealth(): Promise<{ healthy: boolean; details?: any }> {
    if (!this.bucket) {
      return {
        healthy: false,
        details: {
          error: "S3_BUCKET_NAME is not configured",
          region: this.region,
          endpoint: this.endpoint,
          deliveryMode: this.deliveryMode,
        },
      };
    }

    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        })
      );
      return {
        healthy: true,
        details: {
          bucket: this.bucket,
          region: this.region,
          endpoint: this.endpoint,
          deliveryMode: this.deliveryMode,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: {
          bucket: this.bucket,
          region: this.region,
          endpoint: this.endpoint,
          deliveryMode: this.deliveryMode,
          error: error?.message || "HeadBucketCommand failed",
        },
      };
    }
  }
}
