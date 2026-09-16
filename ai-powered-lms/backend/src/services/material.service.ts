import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";
import { CreateMaterialInput } from "../types/academic.types.js";
import { ingestMaterialPdf } from "./ingestion.service.js";
import { storageService } from "./storage/storage.service.js";

const uploadsDir = path.resolve(process.cwd(), "uploads", "materials");

export async function getMaterialsByCourse(courseId: string, studentId?: string) {
  const materials = await prisma.material.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
    include: {
      progressRecords: studentId
        ? {
            where: { studentId },
            select: {
              id: true,
              studentId: true,
              materialId: true,
              currentPage: true,
              totalPages: true,
              progressPercent: true,
              completed: true,
              lastOpenedAt: true,
            },
          }
        : false,
    },
  });

  return materials.map((m) => {
    const progress = m.progressRecords && m.progressRecords.length > 0 ? m.progressRecords[0] : null;
    const { progressRecords, ...rest } = m as any;
    return { ...rest, progress };
  });
}

export async function getMaterialById(materialId: string, studentId?: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          facultyId: true,
        },
      },
      progressRecords: studentId
        ? {
            where: { studentId },
            select: {
              id: true,
              studentId: true,
              materialId: true,
              currentPage: true,
              totalPages: true,
              progressPercent: true,
              completed: true,
              lastOpenedAt: true,
            },
          }
        : false,
    },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  const progress = material.progressRecords && material.progressRecords.length > 0 ? material.progressRecords[0] : null;
  const { progressRecords, ...rest } = material as any;
  return { ...rest, progress };
}

/**
 * Resolves the authorized PDF file stream.
 * Enforces pre-storage authorization checks (student course enrollment verification)
 * before retrieving from cloud S3 or local storage.
 */
export async function getMaterialFile(materialId: string, userId: string, role: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: {
      course: {
        select: { id: true, code: true, title: true, facultyId: true },
      },
    },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  // Student must be actively enrolled in the course offering this material
  if (role === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: userId,
          courseId: material.courseId,
        },
      },
    });

    if (!enrollment) {
      throw Object.assign(
        new Error("Forbidden: You are not enrolled in the course offering this material"),
        { statusCode: 403 }
      );
    }
  }

  if (!material.fileUrl) {
    throw Object.assign(new Error("Material has no associated file"), { statusCode: 404 });
  }

  const fileStream = await storageService.getFileStream(material.fileUrl);

  return {
    stream: fileStream.stream,
    contentLength: fileStream.contentLength,
    contentType: fileStream.contentType || "application/pdf",
    title: material.title,
    unit: material.unit,
    fileType: material.fileType || "pdf",
  };
}

/**
 * Generates a valid standard PDF 1.4 file buffer.
 */
function createFallbackPdf(title: string, unit: string): Buffer {
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

/**
 * Retrieves learning progress for a material.
 */
export async function getStudentMaterialProgress(
  materialId: string,
  studentId: string,
  requesterId: string,
  requesterRole: string
) {
  // IDOR Isolation: Students can ONLY query their own progress
  if (requesterRole === "STUDENT" && requesterId !== studentId) {
    throw Object.assign(
      new Error("Forbidden: You cannot access another student's learning progress"),
      { statusCode: 403 }
    );
  }

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, courseId: true, title: true },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  // If student, check course enrollment
  if (requesterRole === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId: material.courseId,
        },
      },
    });

    if (!enrollment) {
      throw Object.assign(
        new Error("Forbidden: You are not enrolled in this course"),
        { statusCode: 403 }
      );
    }
  }

  const progress = await prisma.materialProgress.findUnique({
    where: {
      studentId_materialId: {
        studentId,
        materialId,
      },
    },
  });

  if (!progress) {
    return {
      studentId,
      materialId,
      currentPage: 1,
      totalPages: 1,
      progressPercent: 0,
      completed: false,
      lastOpenedAt: null,
    };
  }

  return progress;
}

/**
 * Updates or creates learning progress for a material.
 */
export async function updateStudentMaterialProgress(
  materialId: string,
  studentId: string,
  data: {
    currentPage: number;
    totalPages: number;
    completed?: boolean;
  },
  requesterId: string,
  requesterRole: string
) {
  // IDOR Isolation: Students can ONLY modify their own progress
  if (requesterRole === "STUDENT" && requesterId !== studentId) {
    throw Object.assign(
      new Error("Forbidden: You cannot modify another student's learning progress"),
      { statusCode: 403 }
    );
  }

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, courseId: true },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  // If student, check course enrollment
  if (requesterRole === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId: material.courseId,
        },
      },
    });

    if (!enrollment) {
      throw Object.assign(
        new Error("Forbidden: You are not enrolled in this course"),
        { statusCode: 403 }
      );
    }
  }

  const currentPage = Math.max(1, Number(data.currentPage) || 1);
  const totalPages = Math.max(1, Number(data.totalPages) || 1);
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentPage / totalPages) * 100)));
  const completed = data.completed ?? (currentPage >= totalPages || progressPercent >= 100);

  const updatedProgress = await prisma.materialProgress.upsert({
    where: {
      studentId_materialId: {
        studentId,
        materialId,
      },
    },
    update: {
      currentPage,
      totalPages,
      progressPercent,
      completed,
      lastOpenedAt: new Date(),
    },
    create: {
      studentId,
      materialId,
      currentPage,
      totalPages,
      progressPercent,
      completed,
      lastOpenedAt: new Date(),
    },
  });

  return updatedProgress;
}

export async function createMaterial(
  courseId: string,
  input: CreateMaterialInput,
  facultyId: string,
  role: string,
  fileBufferOrPath?: Buffer | string,
  originalFilename?: string
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && course.facultyId !== facultyId) {
    throw Object.assign(
      new Error("Forbidden: You can only upload materials for your own courses"),
      { statusCode: 403 }
    );
  }

  const { title, unit, fileType, fileSize, fileUrl } = input;
  if (!title || !unit) {
    throw Object.assign(new Error("Material title and unit are required"), { statusCode: 400 });
  }

  // If a file buffer or path is provided, execute multi-stage upload + ingestion with compensation
  if (fileBufferOrPath) {
    const buffer = Buffer.isBuffer(fileBufferOrPath)
      ? fileBufferOrPath
      : fs.readFileSync(fileBufferOrPath);

    const filename =
      originalFilename ||
      (typeof fileBufferOrPath === "string"
        ? path.basename(fileBufferOrPath)
        : `${title.replace(/[^a-zA-Z0-9.-]/g, "_")}.pdf`);

    const computedSize = `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`;

    // Step 2: Generate Material record in PostgreSQL with status="PROCESSING"
    const material = await prisma.material.create({
      data: {
        courseId,
        title: title.trim(),
        unit: unit.trim(),
        fileType: fileType || "pdf",
        fileSize: fileSize || computedSize,
        fileUrl: null,
        processingStatus: "PROCESSING",
        ragChunksCount: 0,
      },
    });

    // Step 3: Upload buffer to active storage provider (AWS S3 or Local)
    let storageKey: string;
    try {
      storageKey = await storageService.uploadMaterial(
        courseId,
        material.id,
        filename,
        buffer,
        { contentType: "application/pdf" }
      );
    } catch (uploadError: any) {
      // Scenario 1: Storage Upload Fails -> abort, delete DB record, return HTTP 503
      await prisma.material.delete({ where: { id: material.id } }).catch(() => {});
      throw Object.assign(
        new Error("Cloud storage service unavailable. Upload aborted."),
        { statusCode: 503, cause: uploadError }
      );
    }

    // Step 4 & 5: Ingestion Pipeline (text extraction, chunking, Gemini 3072-dim embeddings, DB DocumentChunks)
    let totalChunks = 0;
    try {
      const ingestionResult = await ingestMaterialPdf(material.id, buffer);
      totalChunks = ingestionResult.totalChunks;
    } catch (ingestionError: any) {
      // Scenario 2: Ingestion Fails -> compensatory cleanup of uploaded storage object, mark Material FAILED
      await storageService.deleteFile(storageKey).catch((delErr) => {
        console.error(`[STORAGE COMPENSATION ERROR] Failed to delete orphaned object ${storageKey}:`, delErr);
      });

      await prisma.material.update({
        where: { id: material.id },
        data: { processingStatus: "FAILED" },
      }).catch(() => {});

      const statusCode = ingestionError.statusCode || 422;
      throw Object.assign(
        new Error(`PDF processing failed. Cloud storage cleaned up: ${ingestionError?.message || "Ingestion failed"}`),
        { statusCode, cause: ingestionError }
      );
    }

    // Step 6: Update Material status to "READY" and set fileUrl = storageKey
    try {
      const readyMaterial = await prisma.material.update({
        where: { id: material.id },
        data: {
          fileUrl: storageKey,
          processingStatus: "READY",
          ragChunksCount: totalChunks,
        },
      });
      return readyMaterial;
    } catch (dbError: any) {
      // Scenario 3: Final DB update fails -> delete storage object
      await storageService.deleteFile(storageKey).catch(() => {});
      throw dbError;
    }
  }

  // Metadata-only Material creation (no file uploaded)
  return await prisma.material.create({
    data: {
      courseId,
      title: title.trim(),
      unit: unit.trim(),
      fileType: fileType || "pdf",
      fileSize: fileSize || "2.5 MB",
      fileUrl: fileUrl || null,
      processingStatus: "READY",
      ragChunksCount: 0,
    },
  });
}

export async function updateMaterial(
  materialId: string,
  input: Partial<CreateMaterialInput>,
  userId: string,
  role: string
) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { course: true },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && material.course.facultyId !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only edit materials for your own courses"),
      { statusCode: 403 }
    );
  }

  return await prisma.material.update({
    where: { id: materialId },
    data: {
      ...(input.title && { title: input.title.trim() }),
      ...(input.unit && { unit: input.unit.trim() }),
      ...(input.fileType && { fileType: input.fileType }),
      ...(input.fileSize && { fileSize: input.fileSize }),
      ...(input.fileUrl && { fileUrl: input.fileUrl }),
    },
  });
}

export async function deleteMaterial(materialId: string, userId: string, role: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { course: true },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && material.course.facultyId !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only delete materials for your own courses"),
      { statusCode: 403 }
    );
  }

  // Pre-authorization passed; delete file from storage idempotently
  if (material.fileUrl) {
    try {
      await storageService.deleteFile(material.fileUrl);
    } catch (storageError) {
      console.warn(`[STORAGE DELETE WARN] Failed to delete file for material ${materialId}:`, storageError);
    }
  }

  await prisma.material.delete({ where: { id: materialId } });
  return { message: "Material deleted successfully" };
}

export async function getMaterialChunks(
  materialId: string,
  page = 1,
  limit = 20
) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, title: true, unit: true, courseId: true, ragChunksCount: true },
  });

  if (!material) {
    throw Object.assign(new Error("Material not found"), { statusCode: 404 });
  }

  const offset = (page - 1) * limit;
  const [totalChunks, chunks] = await Promise.all([
    prisma.documentChunk.count({ where: { materialId } }),
    prisma.documentChunk.findMany({
      where: { materialId },
      orderBy: { chunkIndex: "asc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        chunkIndex: true,
        pageNumber: true,
        characterCount: true,
        tokenCount: true,
        content: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    materialId: material.id,
    materialTitle: material.title,
    unit: material.unit,
    totalChunks,
    page,
    limit,
    totalPages: Math.ceil(totalChunks / limit),
    chunks,
  };
}

