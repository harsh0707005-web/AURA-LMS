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

    let localPath = this.resolveLocalPath(key);
    if (!localPath || !fs.existsSync(localPath)) {
      // Generate fallback standard PDF for local development/seed data
      const filename = path.basename(key);
      const fallbackFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
      const fallbackPath = path.join(this.uploadsDir, fallbackFilename);
      if (!fs.existsSync(fallbackPath)) {
        const generated = createFallbackPdf(filename, "Course Material");
        await fs.promises.writeFile(fallbackPath, generated);
      }
      localPath = fallbackPath;
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

export function createFallbackPdf(title: string, unit: string): Buffer {
  const sanitizedTitle = title.replace(/[()\\]/g, "");
  const sanitizedUnit = unit.replace(/[()\\]/g, "");

  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>
endobj
6 0 obj
<< /Length 210 >>
stream
BT
/F1 22 Tf
50 720 Td
(${sanitizedTitle}) Tj
/F1 14 Tf
0 -40 Td
(${sanitizedUnit} - Academic Course Material) Tj
/F1 11 Tf
0 -40 Td
(Section 1: Theoretical Foundations and Architecture Overview.) Tj
ET
endstream
endobj
7 0 obj
<< /Length 190 >>
stream
BT
/F1 18 Tf
50 720 Td
(${sanitizedUnit}: Core Principles and Implementations) Tj
/F1 11 Tf
0 -40 Td
(Section 2: Detailed Protocol Invariants, Invariants and Verification.) Tj
ET
endstream
endobj
8 0 obj
<< /Length 180 >>
stream
BT
/F1 18 Tf
50 720 Td
(${sanitizedUnit}: Evaluation and Advanced Topics) Tj
/F1 11 Tf
0 -40 Td
(Section 3: Practical Experiments, Analysis and Assessment Tasks.) Tj
ET
endstream
endobj
9 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 10
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000133 00000 n 
0000000257 00000 n 
0000000381 00000 n 
0000000505 00000 n 
0000000768 00000 n 
0000001011 00000 n 
0000001244 00000 n 
trailer
<< /Size 10 /Root 1 0 R >>
startxref
1325
%%EOF`;

  return Buffer.from(content, "utf-8");
}

