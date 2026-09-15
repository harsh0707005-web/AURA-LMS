# Phase 14 Plan: S3 Cloud Storage Migration (Revised)

**Phase:** Phase 14: S3 Cloud Storage Migration  
**Milestone:** Milestone 2 (v2.0 - Production Hardening & Cloud Scaling)  
**Status:** REVISED PLAN AWAITING EXECUTION APPROVAL  

---

## 1. Executive Summary & Objective

Migrate learning-material PDF storage from the existing local filesystem implementation (`backend/uploads/materials/`) to an AWS S3 cloud object storage architecture while preserving 100% of existing functionality, security boundaries, and frontend contracts.

### Core Architecture Pillars (Revised)
- **Delivery Strategy**: Backend Proxy Stream. Express authenticates JWT, validates student course enrollment, pulls the private S3 object stream, and pipes it directly to the response. S3 bucket remains 100% private.
- **Frontend Compatibility**: `frontend/components/materials/PDFViewerModal.tsx` contract remains completely unchanged.
- **fileUrl Semantics**: In PostgreSQL, `Material.fileUrl` stores the **storage object key** (e.g., `materials/courses/...`) or local legacy path (`/uploads/materials/...`), never a public browser URL.
- **Robust Consistency & Orphan Cleanup**: Multi-stage upload-ingestion pipeline with automatic compensation/orphan cleanup on partial failures.
- **Idempotent Migration & Safe Rollback**: Resumable migration script with validation checks, automated reverse-migration procedure (`restore-materials-from-s3.ts`), and explicit path-format detection so `S3_ENABLED=false` never misidentifies cloud keys as local files.
- **Memory Storage Guardrails**: Strict 25MB file limits, magic-byte inspection (`%PDF-`), and HTTP 413 error handling.

---

## 2. File & Component Change Matrix

### Files to Create [NEW]
| File | Layer | Purpose |
| :--- | :--- | :--- |
| [`backend/src/services/storage/storage.interface.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/storage/storage.interface.ts) | Backend Storage | Defines `IStorageProvider` contract (`uploadFile`, `getFileStream`, `deleteFile`, `fileExists`, `getHealth`). |
| [`backend/src/services/storage/local.storage.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/storage/local.storage.ts) | Backend Storage | Local filesystem provider implementing `IStorageProvider` with path-format validation. |
| [`backend/src/services/storage/s3.storage.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/storage/s3.storage.ts) | Backend Storage | S3 cloud object storage provider using `@aws-sdk/client-s3` with idempotent deletion and streaming conversion. |
| [`backend/src/services/storage/storage.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/storage/storage.service.ts) | Backend Storage | Singleton/factory resolving `S3StorageProvider` or `LocalStorageProvider` based on `S3_ENABLED`, exposing storage classification helpers. |
| [`backend/src/scripts/migrate-materials-to-s3.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/scripts/migrate-materials-to-s3.ts) | Migration Script | Idempotent, resumable forward-migration script copying local PDFs to S3 with pre/post-upload verification, preserving local backups. |
| [`backend/src/scripts/restore-materials-from-s3.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/scripts/restore-materials-from-s3.ts) | Rollback Script | Documented reverse-migration script restoring S3 objects back to `backend/uploads/materials/` and updating database paths. |
| [`backend/src/scripts/test-phase14-s3.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/scripts/test-phase14-s3.ts) | Test Suite | 9-suite automated verification script testing edge cases, failures, idempotency, and security boundaries. |

### Files to Modify [MODIFY]
| File | Layer | Changes |
| :--- | :--- | :--- |
| [`backend/package.json`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/package.json) | Dependencies | Add `@aws-sdk/client-s3` (`^3.750.0`); add `"migrate:s3"`, `"restore:s3"`, and `"test:s3"` scripts. |
| [`backend/src/middleware/upload.middleware.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/middleware/upload.middleware.ts) | Middleware | Switch to `multer.memoryStorage()`, enforce 25MB limit with `LIMIT_FILE_SIZE` error mapping (HTTP 413), validate PDF MIME & magic bytes (`%PDF-`). |
| [`backend/src/services/material.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/material.service.ts) | Service | Implement consistent upload-ingestion with S3 orphan cleanup; enforce pre-S3 authorization checks; validate storage keys in `getMaterialFile()`; implement safe deletion. |
| [`backend/src/controllers/material.controller.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/controllers/material.controller.ts) | Controller | Pipe stream from `getMaterialFile()` to `res`; map storage 404/503 errors to clean client responses. |
| [`backend/src/server.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/server.ts) | Server Core | Include storage provider status indicator in `/api/health`. |

---

## 3. Storage Provider Interface & fileUrl Semantics

### 3.1 `Material.fileUrl` Semantics
- **Historical Semantics**: Previously stored local relative paths like `/uploads/materials/1787351516245-...pdf` or seed aliases like `/materials/cs401-unit1-rpc.pdf`.
- **Post-Migration Semantics**: Stores the **Storage Object Key** identifying the resource within the active storage provider:
  - S3 Object Key: `materials/courses/{courseId}/{materialId}/{sanitizedFilename}.pdf`
  - Local Path (Legacy / Offline): `/uploads/materials/{filename}.pdf`
- **Frontend Isolation**: The frontend NEVER receives or constructs raw S3 URLs. All student and faculty downloads flow through `GET /api/materials/:id/file`.

### 3.2 Storage Interface (`backend/src/services/storage/storage.interface.ts`)
```typescript
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
```

---

## 4. Multi-Stage Upload + Ingestion Consistency Matrix

Because S3 cloud upload and PostgreSQL Prisma ingestion are not governed by a distributed 2-phase commit, the system enforces a strict state machine with compensatory cleanup:

```
Step 1: Parse multipart PDF via Multer memoryStorage (25MB limit + %PDF- magic bytes)
Step 2: Generate Material record in PostgreSQL with status="PROCESSING"
Step 3: Upload buffer to AWS S3
Step 4: Execute Ingestion Pipeline (text extraction, chunking, Gemini 3072-dim embeddings)
Step 5: Persist DocumentChunk records in PostgreSQL
Step 6: Update Material status to "READY" and set fileUrl = s3Key
```

### Failure & Compensation Matrix
| Scenario | What Happens | Compensatory Action | System Outcome & Client Response |
| :--- | :--- | :--- | :--- |
| **1. S3 Upload Fails** | Network timeout, invalid AWS credentials, or bucket missing. | DB transaction aborted; no chunks generated; `Material` record deleted or marked `FAILED`. | HTTP 503: `"Cloud storage service unavailable. Upload aborted."` Zero orphaned files. |
| **2. Ingestion Fails (Corrupt PDF, Gemini API rate limit, DB failure)** | Text cannot be extracted, or vector embeddings fail after S3 upload succeeded. | Catch block invokes `storageService.deleteFile(s3Key)` to remove the uploaded S3 object; marks `Material.processingStatus = "FAILED"`. | HTTP 422/502: `"PDF processing failed. Cloud storage cleaned up."` No orphaned S3 objects. |
| **3. DB Update Fails after Ingestion & S3 Upload** | Database connection drops during final `Material.update()`. | Global error handler triggers compensatory S3 object deletion (`storageService.deleteFile(s3Key)`). | HTTP 500: Database error returned. No orphaned S3 objects. |
| **4. All Steps Succeed** | S3 uploaded, chunks generated, vector embeddings saved in DB. | None required. | HTTP 201: Material `READY` with `ragChunksCount` and valid storage key. |

---

## 5. Memory Storage Safety & Guardrails

To prevent Node.js event-loop blocking or Out-Of-Memory (OOM) crashes when buffering files in memory:

1. **Strict Maximum Size Limit**:
   - Multer configured with `limits: { fileSize: 25 * 1024 * 1024, files: 1 }` (25 MB max).
2. **Error Interception**:
   - Multer `LIMIT_FILE_SIZE` error is caught explicitly in `upload.middleware.ts` / error handler and returned as **`413 Payload Too Large`** with `{ success: false, message: "File exceeds maximum permitted size of 25 MB" }`.
3. **MIME & Magic Bytes Validation**:
   - First checks `file.mimetype === "application/pdf"` and extension `.pdf`.
   - Secondary inspection on `buffer`: verifies the first 5 bytes match `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`). Files without this magic byte sequence are rejected immediately with `400 Bad Request: Invalid PDF structure`.
4. **Immediate Lifecycle Release**:
   - Buffers are passed directly to S3 and `pdf-parse`, and dereferenced immediately after the request handler terminates to allow prompt garbage collection.

---

## 6. S3 Deletion Idempotency & Authorization Guard

- **Pre-Authorization Requirement**: All delete operations (`DELETE /api/materials/:id`) first authenticate the user, query the `Material` and associated `Course`, and verify that `req.user.role === "ADMIN"` OR `course.facultyId === req.user.userId`. If unauthorized, **`403 Forbidden`** is returned immediately without contacting S3.
- **Idempotent S3 Deletion**:
  - `s3.storage.ts` executes `DeleteObjectCommand`.
  - AWS S3 natively treats deleting non-existent objects as a success (HTTP 204).
  - If the cloud object was already deleted or missing, the operation proceeds without throwing, ensuring the database record and associated vector chunks can still be deleted cleanly.

---

## 7. Real Rollback Strategy & Reverse Migration

### 7.1 Path-Format Classification
When `S3_ENABLED=false` (e.g. during an emergency rollback), `storage.service.ts` inspects `Material.fileUrl`:
- **Local Path** (`/uploads/materials/...` or `/materials/...`): Served normally by `LocalStorageProvider`.
- **S3 Object Key** (`materials/courses/...`): Recognized as a cloud-migrated object.
  - The system **does not** pretend it is available locally.
  - Returns a clear error: **`503 Service Unavailable: Material is stored in cloud S3, but S3 storage is currently disabled on this server.`**

### 7.2 Reverse Migration Procedure (`restore-materials-from-s3.ts`)
If a full rollback from S3 to local filesystem is required:
1. Run `npm run restore:s3` (`backend/src/scripts/restore-materials-from-s3.ts`).
2. The script:
   - Queries all `Material` records with `fileUrl` matching `materials/courses/*`.
   - Downloads each object from AWS S3 via `GetObjectCommand`.
   - Saves the file to `backend/uploads/materials/{material.id}-{filename}.pdf`.
   - Updates `Material.fileUrl` in PostgreSQL to `/uploads/materials/{filename}.pdf`.
   - Confirms local file exists on disk.
3. Once restored, switch `.env` to `S3_ENABLED=false` and restart server.
4. Application availability is preserved throughout.

---

## 8. Idempotent & Resumable Migration Script (`migrate-materials-to-s3.ts`)

The migration script safely backfills existing local PDFs to S3:

### Step-by-Step Migration Algorithm
```typescript
1. Fetch all Material records from PostgreSQL.
2. Filter for records where fileUrl does NOT already start with "materials/courses/".
3. For each material:
   a. Verify local source file exists on disk:
      - Check candidate path in backend/uploads/materials/
      - Check seed path in public/ or fallback generator
      - If missing on disk, log warning [SKIP: LOCAL_MISSING] and continue.
   b. Determine target S3 key:
      materials/courses/${material.courseId}/${material.id}/${sanitizedFilename}.pdf
   c. Check if object already exists in S3 (HeadObjectCommand):
      - If exists and size matches local file: Skip upload [ALREADY_EXISTS].
   d. Upload to S3 if missing or size mismatch:
      - PutObjectCommand with Body: fs.readFileSync(localPath), ContentType: "application/pdf"
   e. Verify upload success via HeadObjectCommand.
   f. Update PostgreSQL:
      prisma.material.update({ where: { id: material.id }, data: { fileUrl: s3Key } })
   g. Log [MIGRATED]: material.id -> s3Key.
4. NEVER delete local files. Keep all local PDFs intact as permanent backups.
```

---

## 9. Comprehensive Automated Test Suite (`test-phase14-s3.ts`)

The test suite validates all 9 edge cases and security boundaries:

| Test Case | Scenario | Expected Behavior |
| :--- | :--- | :--- |
| **Test 1: S3 Connectivity** | Validates S3 client and bucket permissions. | `HeadBucketCommand` returns 200 OK. |
| **Test 2: Successful Upload & Ingestion** | Uploads 2MB PDF via multipart. | S3 object created under `materials/courses/...`, chunks and 3072-dim embeddings stored in DB, Material `READY`. |
| **Test 3: Failed S3 Upload** | Simulates invalid bucket / network drop. | Transaction aborted, no chunks created, returns HTTP 503. |
| **Test 4: Ingestion Failure Compensation** | Injects invalid/unparseable PDF. | Ingestion fails, uploaded S3 object is deleted by compensation handler, Material marked `FAILED`. |
| **Test 5: Oversized Upload Rejection** | Uploads file $> 25$ MB. | Multer rejects with **`413 Payload Too Large`** before buffering. |
| **Test 6: Idempotent Migration & Resume** | Runs migration twice consecutively. | First run uploads; second run detects existing objects and skips redundant uploads. |
| **Test 7: Offline Mode with S3 Keys** | Sets `S3_ENABLED=false` and requests S3 material. | Returns explicit HTTP 503 explaining cloud storage is disabled; does not crash. |
| **Test 8: Missing S3 Object Handling** | Deletes S3 object out-of-band and requests stream. | Returns structured HTTP 404/503 without unhandled rejection. |
| **Test 9: Pre-S3 Authorization Enforcement** | Unenrolled student requests material. | Blocked with **`403 Forbidden`** before any S3 API call is dispatched. |

---

## 10. Acceptance Criteria

- [ ] `@aws-sdk/client-s3` installed in `backend/package.json`.
- [ ] `IStorageProvider` interface implemented with `S3StorageProvider` and `LocalStorageProvider`.
- [ ] Multer memory storage enforces 25MB limit with HTTP 413 error and `%PDF-` magic-byte verification.
- [ ] `createMaterial` performs atomic compensation (deletes S3 object if ingestion fails).
- [ ] `Material.fileUrl` stores storage object keys, not public URLs. Frontend contract is 100% unchanged.
- [ ] S3 bucket remains strictly private with all public access blocked.
- [ ] S3 deletion is idempotent and verified against course ownership before execution.
- [ ] `migrate-materials-to-s3.ts` is idempotent and resumable, verifying local source and S3 destination without deleting local files.
- [ ] `restore-materials-from-s3.ts` reverse-migration script is available and documented.
- [ ] When `S3_ENABLED=false`, local materials work and S3-migrated materials return explicit 503 errors.
- [ ] All 9 automated test scenarios in `test-phase14-s3.ts` pass.
- [ ] TypeScript compilation (`npm run build`) passes with 0 errors.
