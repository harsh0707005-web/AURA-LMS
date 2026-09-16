import multer from "multer";
import path from "path";
import { Request, Response, NextFunction } from "express";

const storage = multer.memoryStorage();

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.mimetype === "application/pdf" || ext === ".pdf") {
    cb(null, true);
  } else {
    const error = Object.assign(
      new Error("Invalid file type. Only PDF documents (.pdf) are allowed"),
      { statusCode: 400 }
    );
    cb(error);
  }
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
    files: 1,
  },
});

/**
 * Validates that the buffer begins with standard PDF magic bytes: `%PDF-` (0x25 0x50 0x44 0x46 0x2D).
 */
export function isValidPdfMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d    // -
  );
}

export const uploadMaterialPdf = {
  single(fieldName: string = "file") {
    const uploadHandler = multerInstance.single(fieldName);

    return (req: Request, res: Response, next: NextFunction): void => {
      uploadHandler(req, res, (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({
              success: false,
              message: "File exceeds maximum permitted size of 25 MB",
            });
            return;
          }
          const statusCode = err.statusCode || 400;
          res.status(statusCode).json({
            success: false,
            message: err.message || "File upload failed",
          });
          return;
        }

        // Validate PDF magic bytes on uploaded buffer
        if (req.file && req.file.buffer) {
          if (!isValidPdfMagicBytes(req.file.buffer)) {
            res.status(400).json({
              success: false,
              message: "Invalid PDF structure. File must begin with %PDF- header.",
            });
            return;
          }
        }

        next();
      });
    };
  },
};
