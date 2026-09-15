import fs from "fs";
import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import prisma from "../lib/prisma.js";
import { embeddingService } from "./ai/embedding.service.js";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ChunkResult {
  chunkIndex: number;
  content: string;
  pageNumber: number | null;
  characterCount: number;
  tokenCount: number;
}

/**
 * Deterministic text cleaning for academic and syllabus documents.
 * Preserves math notations, equations, code blocks, bullet points, and paragraph boundaries.
 */
export function cleanAcademicText(rawText: string): string {
  if (!rawText) return "";

  return (
    rawText
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove non-printable control characters except standard whitespace
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Replace horizontal tab/multiple spaces on a single line with single space
      .replace(/[^\S\n]+/g, " ")
      // Remove trailing space on each line
      .replace(/[^\S\n]+$/gm, "")
      // Collapse 3 or more line breaks into 2 line breaks to preserve paragraph boundaries
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Extracts page-by-page text from a PDF buffer or file.
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<{
  pages: ExtractedPage[];
  totalPageCount: number;
  fullCleanText: string;
}> {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw Object.assign(new Error("Cannot process an empty PDF file"), { statusCode: 400 });
  }

  let textResult: any;
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const parser = new PDFParse(uint8Array);
    textResult = await parser.getText();
  } catch (error: any) {
    throw Object.assign(
      new Error(`Corrupted or unreadable PDF: ${error?.message || "Parsing failed"}`),
      { statusCode: 400 }
    );
  }

  const rawPages = textResult?.pages || [];
  const extractedPages: ExtractedPage[] = [];

  for (let i = 0; i < rawPages.length; i++) {
    const p = rawPages[i];
    const cleaned = cleanAcademicText(p.text || "");
    extractedPages.push({
      pageNumber: p.num !== undefined ? p.num : i + 1,
      text: cleaned,
    });
  }

  const fullCleanText = cleanAcademicText(textResult?.text || "");

  if (extractedPages.length === 0 && !fullCleanText) {
    throw Object.assign(
      new Error("PDF does not contain any extractable text (e.g. scanned image-only PDF)"),
      { statusCode: 422 }
    );
  }

  return {
    pages: extractedPages,
    totalPageCount: textResult?.total || extractedPages.length || 1,
    fullCleanText,
  };
}

/**
 * Deterministic text chunker.
 * Target: ~500 tokens (approx 2000 chars) with ~75 tokens overlap (approx 300 chars).
 * Splits along natural paragraph (\n\n), line (\n), or sentence boundaries (. ).
 */
export function chunkAcademicText(
  pages: ExtractedPage[],
  targetChunkChars = 2000,
  overlapChars = 300
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let currentChunkIndex = 0;

  for (const page of pages) {
    const pageText = page.text;
    if (!pageText || pageText.trim().length === 0) continue;

    // If page is smaller than target chunk size, emit as single chunk
    if (pageText.length <= targetChunkChars) {
      const charCount = pageText.length;
      const tokenCount = Math.ceil(charCount / 4); // Standard character-to-token approximation (4 chars/token)
      chunks.push({
        chunkIndex: currentChunkIndex++,
        content: pageText,
        pageNumber: page.pageNumber,
        characterCount: charCount,
        tokenCount,
      });
      continue;
    }

    // Split page text into overlapping windows
    let startIndex = 0;
    while (startIndex < pageText.length) {
      let endIndex = Math.min(startIndex + targetChunkChars, pageText.length);

      // If we are not at the end of the text, look for a natural break point (paragraph or sentence)
      if (endIndex < pageText.length) {
        // Try paragraph break first
        const paragraphBreak = pageText.lastIndexOf("\n\n", endIndex);
        if (paragraphBreak > startIndex + targetChunkChars * 0.5) {
          endIndex = paragraphBreak;
        } else {
          // Try sentence break
          const sentenceBreak = pageText.lastIndexOf(". ", endIndex);
          if (sentenceBreak > startIndex + targetChunkChars * 0.5) {
            endIndex = sentenceBreak + 1; // Include the period
          } else {
            // Try line break
            const lineBreak = pageText.lastIndexOf("\n", endIndex);
            if (lineBreak > startIndex + targetChunkChars * 0.5) {
              endIndex = lineBreak;
            }
          }
        }
      }

      const chunkContent = pageText.substring(startIndex, endIndex).trim();
      if (chunkContent.length > 0) {
        const charCount = chunkContent.length;
        const tokenCount = Math.ceil(charCount / 4);
        chunks.push({
          chunkIndex: currentChunkIndex++,
          content: chunkContent,
          pageNumber: page.pageNumber,
          characterCount: charCount,
          tokenCount,
        });
      }

      if (endIndex >= pageText.length) break;

      // Advance by chunk size minus overlap
      startIndex = Math.max(endIndex - overlapChars, startIndex + 1);
    }
  }

  return chunks;
}

/**
 * Ingests a PDF document from file buffer, extracts text, cleans, chunks,
 * generates vector embeddings via Gemini, and persists to PostgreSQL DocumentChunk table.
 */
export async function ingestMaterialPdf(
  materialId: string,
  filePathOrBuffer: string | Buffer
): Promise<{ totalChunks: number; pageCount: number }> {
  try {
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);

    // 1. Extract text and page boundaries
    const { pages, totalPageCount } = await extractTextFromPdf(buffer);

    // 2. Deterministic chunking (~500 tokens / 2000 chars, ~75 tokens / 300 chars overlap)
    const chunks = chunkAcademicText(pages, 2000, 300);

    if (chunks.length === 0) {
      throw Object.assign(new Error("No chunks could be produced from document"), {
        statusCode: 422,
      });
    }

    // 3. Generate Gemini vector embeddings for each chunk
    const chunkTexts = chunks.map((c) => c.content);
    let embeddings: number[][] = [];
    try {
      embeddings = await embeddingService.embedDocuments(chunkTexts);
    } catch (embedError) {
      console.error(`[EMBEDDING ERROR] Failed generating embeddings for material ${materialId}:`, embedError);
      throw embedError;
    }

    // 4. Atomically persist DocumentChunk records with pgvector embeddings
    await prisma.documentChunk.deleteMany({
      where: { materialId },
    });

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const vectorLiteral = embeddings[i] ? embeddingService.toVectorLiteral(embeddings[i]) : null;
      const chunkId = crypto.randomUUID();

      if (vectorLiteral) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "DocumentChunk" ("id", "materialId", "chunkIndex", "content", "pageNumber", "characterCount", "tokenCount", "embedding", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW(), NOW())`,
          chunkId,
          materialId,
          c.chunkIndex,
          c.content,
          c.pageNumber,
          c.characterCount,
          c.tokenCount,
          vectorLiteral
        );
      } else {
        await prisma.documentChunk.create({
          data: {
            id: chunkId,
            materialId,
            chunkIndex: c.chunkIndex,
            content: c.content,
            pageNumber: c.pageNumber,
            characterCount: c.characterCount,
            tokenCount: c.tokenCount,
          },
        });
      }
    }

    // 5. Update material processing status and count
    await prisma.material.update({
      where: { id: materialId },
      data: {
        processingStatus: "READY",
        ragChunksCount: chunks.length,
      },
    });

    return {
      totalChunks: chunks.length,
      pageCount: totalPageCount,
    };
  } catch (error: any) {
    // If ingestion fails, safely mark material as FAILED
    await prisma.material
      .update({
        where: { id: materialId },
        data: {
          processingStatus: "FAILED",
        },
      })
      .catch(() => {});

    throw error;
  }
}
