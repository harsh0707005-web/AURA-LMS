# Phase 14 Context & Confirmed Decisions: S3 Cloud Storage Migration

**Phase:** Phase 14: S3 Cloud Storage Migration  
**Milestone:** Milestone 2 (v2.0 - Production Hardening & Cloud Scaling)  
**Status:** Locked Decisions for Planning  

---

## 1. Confirmed Architecture Decisions

### Decision 1: Delivery Strategy — Option A (Backend Proxy Stream)
- **Mechanism**: The Express backend intercepts all requests to `GET /api/materials/:id/file`, verifies user authentication (JWT) and course enrollment (if student), retrieves the private S3 object using `@aws-sdk/client-s3`, and pipes the binary stream directly into the HTTP response.
- **Frontend Impact**: **Zero frontend changes.** The contract for `PDFViewerModal.tsx` remains completely untouched.
- **Security**: The S3 bucket remains 100% private. No public S3 URLs or signed URL redirect leaks are ever exposed to client browsers.

### Decision 2: Storage Provider — AWS S3 (AWS SDK v3)
- **SDK**: Official `@aws-sdk/client-s3` package.
- **Bucket Policy**: Private bucket with public access block enabled (`BlockPublicAcls`, `BlockPublicPolicy`, `IgnorePublicAcls`, `RestrictPublicBuckets`).
- **Object Key Scheme**:
  ```
  materials/courses/{courseId}/{materialId}/{sanitizedFilename}.pdf
  ```
  - Hierarchically organized by course and material ID.
  - Server-side generated to eliminate path traversal vulnerabilities.

### Decision 3: Development & Offline Fallback Mode
- **Configuration**: Explicitly governed by `S3_ENABLED=true/false` in `backend/.env`.
- **Local Mode (`S3_ENABLED=false`)**: Smoothly uses `LocalStorageProvider` (persisting to `backend/uploads/materials`), allowing offline development and test runners without AWS credentials.
- **Strict Error Surfacing (`S3_ENABLED=true`)**: When S3 is enabled, S3 failures **must not** silently fall back to local disk. Outages, permission failures, or missing buckets must be surfaced immediately with structured error codes (`503 Service Unavailable`).

### Decision 4: Preserving Full Application Functionality
- Authenticated material upload (multipart form data).
- Automated text extraction, page numbering, and deterministic chunking (~500 tokens).
- Google Gemini 3072-dimensional vector embedding generation (`gemini-embedding-001`).
- PostgreSQL pgvector storage in `DocumentChunk` and course-grounded RAG retrieval.
- Protected student PDF streaming with enrollment verification.
- Dynamic canvas rendering in `PDFViewerModal.tsx`.
- Reading progress tracking, debounced auto-save, and resume-from-saved-page.
- Material deletion (deleting DB record, vector chunks, and associated S3 object).

### Decision 5: Migration & Retention of Existing Uploaded PDFs
- Provide a dedicated migration script `backend/src/scripts/migrate-materials-to-s3.ts`.
- The script iterates through existing `Material` records, uploads matching files from `backend/uploads/materials/` to S3, and updates `Material.fileUrl` to the new S3 key format.
- Existing local files **must not** be deleted automatically. They will be retained as a verified local backup.

### Decision 6: Security & Credentials
- AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) remain strictly on the backend.
- Never write credentials into `.env.local` or client-side bundles.
- All file access is guarded by `authenticate` and `getMaterialFile` enrollment checks before any S3 API call is executed.
