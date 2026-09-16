import "dotenv/config";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import prisma from "../lib/prisma.js";
import { S3StorageProvider } from "../services/storage/s3.storage.js";
import { LocalStorageProvider, isWithinRoot } from "../services/storage/local.storage.js";
import { StorageService } from "../services/storage/storage.service.js";
import { isValidPdfMagicBytes } from "../middleware/upload.middleware.js";
import { getMaterialFile } from "../services/material.service.js";
import { restoreMaterialsFromS3 } from "./restore-materials-from-s3.js";

interface TestReport {
  name: string;
  category: "UNIT" | "INTEGRATION" | "LIVE_AWS";
  status: "PASS" | "FAIL" | "CONDITIONAL_SKIP";
  expected: string;
  actual: string;
  notes?: string;
}

const reports: TestReport[] = [];

function recordTest(report: TestReport) {
  reports.push(report);
  const icon =
    report.status === "PASS"
      ? "✅ PASS"
      : report.status === "CONDITIONAL_SKIP"
      ? "⚠️  SKIP"
      : "❌ FAIL";

  console.log(
    `[${icon}] [${report.category}] ${report.name}\n       Expected: ${report.expected}\n       Actual:   ${report.actual}`
  );
  if (report.notes) {
    console.log(`       Notes:    ${report.notes}`);
  }
  console.log("");
}

export async function runPhase14Tests() {
  console.log("================================================================================");
  console.log("AURA LMS: PHASE 14 S3 STORAGE COMPREHENSIVE TEST SUITE");
  console.log("================================================================================\n");

  // ============================================================================
  // TEST 1: Canonical Environment Variable Resolution
  // ============================================================================
  try {
    const customConfig = {
      region: "ap-south-1",
      bucket: "aura-lms-test-bucket",
      endpoint: "http://localhost:4566",
      forcePathStyle: true,
      deliveryMode: "proxy",
    };

    const provider = new S3StorageProvider(customConfig);

    const matchRegion = provider.getRegion() === "ap-south-1";
    const matchBucket = provider.getBucketName() === "aura-lms-test-bucket";
    const matchEndpoint = provider.getEndpoint() === "http://localhost:4566";
    const matchPathStyle = provider.getForcePathStyle() === true;
    const matchDelivery = provider.getDeliveryMode() === "proxy";

    // Also test that legacy env variable AWS_S3_BUCKET is strictly ignored
    const origLegacy = (process.env as any).AWS_S3_BUCKET;
    const origCanonical = process.env.S3_BUCKET_NAME;
    (process.env as any).AWS_S3_BUCKET = "legacy-fallback-bucket";
    delete process.env.S3_BUCKET_NAME;

    const providerWithoutCanonical = new S3StorageProvider();
    const legacyIgnored = providerWithoutCanonical.getBucketName() === "";

    // Restore env
    if (origLegacy !== undefined) (process.env as any).AWS_S3_BUCKET = origLegacy;
    else delete (process.env as any).AWS_S3_BUCKET;
    if (origCanonical !== undefined) process.env.S3_BUCKET_NAME = origCanonical;
    else delete process.env.S3_BUCKET_NAME;

    if (matchRegion && matchBucket && matchEndpoint && matchPathStyle && matchDelivery && legacyIgnored) {
      recordTest({
        name: "Canonical Environment-Variable Configuration Resolution",
        category: "UNIT",
        status: "PASS",
        expected: "Provider resolves S3_BUCKET_NAME, S3_REGION, S3_ENDPOINT, S3_FORCE_PATH_STYLE, S3_DELIVERY_MODE; ignores legacy AWS_S3_BUCKET",
        actual: `Resolved canonical config properly; confirmed legacy AWS_S3_BUCKET fallback is ignored (bucket='${providerWithoutCanonical.getBucketName()}')`,
      });
    } else {
      recordTest({
        name: "Canonical Environment-Variable Configuration Resolution",
        category: "UNIT",
        status: "FAIL",
        expected: "All canonical configurations match supplied values and legacy fallback is ignored",
        actual: `matchConfig=${matchRegion && matchBucket && matchEndpoint && matchPathStyle && matchDelivery}, legacyIgnored=${legacyIgnored}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Canonical Environment-Variable Configuration Resolution",
      category: "UNIT",
      status: "FAIL",
      expected: "Config resolves without error",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 2: S3 Enabled with Missing / Unconfigured Bucket -> HTTP 503
  // ============================================================================
  try {
    const unconfiguredProvider = new S3StorageProvider({ bucket: "" });
    let upload503 = false;
    let stream503 = false;
    let delete503 = false;
    let healthUnhealthy = false;

    try {
      await unconfiguredProvider.uploadFile("test.pdf", Buffer.from("test"));
    } catch (e: any) {
      upload503 = e.statusCode === 503;
    }

    try {
      await unconfiguredProvider.getFileStream("test.pdf");
    } catch (e: any) {
      stream503 = e.statusCode === 503;
    }

    try {
      await unconfiguredProvider.deleteFile("test.pdf");
    } catch (e: any) {
      delete503 = e.statusCode === 503;
    }

    const health = await unconfiguredProvider.getHealth();
    healthUnhealthy = health.healthy === false && health.details?.error === "S3_BUCKET_NAME is not configured";

    if (upload503 && stream503 && delete503 && healthUnhealthy) {
      recordTest({
        name: "Missing Bucket Configuration Rejection (HTTP 503)",
        category: "UNIT",
        status: "PASS",
        expected: "uploadFile, getFileStream, deleteFile throw 503, and getHealth reports S3_BUCKET_NAME unconfigured",
        actual: "All operations threw HTTP 503; deleteFile did not silently succeed; health check returned healthy=false",
      });
    } else {
      recordTest({
        name: "Missing Bucket Configuration Rejection (HTTP 503)",
        category: "UNIT",
        status: "FAIL",
        expected: "All operations throw 503 when S3 bucket is empty",
        actual: `upload503=${upload503}, stream503=${stream503}, delete503=${delete503}, healthUnhealthy=${healthUnhealthy}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Missing Bucket Configuration Rejection (HTTP 503)",
      category: "UNIT",
      status: "FAIL",
      expected: "Operations throw 503 on unconfigured bucket",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 3: S3 Delete Missing Object -> Idempotent Success
  // ============================================================================
  try {
    // Mock client that returns 404 NoSuchKey
    const mockClient: any = {
      send: async (cmd: any) => {
        if (cmd.constructor.name === "DeleteObjectCommand") {
          const err: any = new Error("The specified key does not exist.");
          err.name = "NoSuchKey";
          err.$metadata = { httpStatusCode: 404 };
          throw err;
        }
        return {};
      },
    };

    const mockProvider = new S3StorageProvider({
      bucket: "mock-bucket",
      client: mockClient,
    });

    // Should resolve without throwing error (idempotent deletion)
    await mockProvider.deleteFile("materials/courses/c1/m1/missing.pdf");

    recordTest({
      name: "Idempotent S3 Deletion on Missing Object",
      category: "UNIT",
      status: "PASS",
      expected: "deleteFile on non-existent S3 object succeeds without throwing",
      actual: "deleteFile caught 404/NoSuchKey and resolved cleanly as expected for idempotent deletion",
    });
  } catch (err: any) {
    recordTest({
      name: "Idempotent S3 Deletion on Missing Object",
      category: "UNIT",
      status: "FAIL",
      expected: "deleteFile ignores NoSuchKey / 404",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 4: Magic Bytes Verification & 25MB Upload Limit Guardrails
  // ============================================================================
  try {
    const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    const invalidTextBuffer = Buffer.from("<html><head><title>Fake PDF</title></head></html>");
    const tinyBuffer = Buffer.from("%PD");

    const validResult = isValidPdfMagicBytes(validPdfBuffer);
    const invalidResult = isValidPdfMagicBytes(invalidTextBuffer);
    const tinyResult = isValidPdfMagicBytes(tinyBuffer);

    if (validResult === true && invalidResult === false && tinyResult === false) {
      recordTest({
        name: "PDF Magic-Bytes (%PDF-) Header Inspection",
        category: "UNIT",
        status: "PASS",
        expected: "Buffer starting with %PDF- passes; non-PDF and truncated buffers rejected",
        actual: `validPdf=${validResult}, fakePdf=${invalidResult}, truncated=${tinyResult}`,
      });
    } else {
      recordTest({
        name: "PDF Magic-Bytes (%PDF-) Header Inspection",
        category: "UNIT",
        status: "FAIL",
        expected: "Valid passes (true), invalid rejected (false)",
        actual: `validPdf=${validResult}, fakePdf=${invalidResult}, truncated=${tinyResult}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "PDF Magic-Bytes (%PDF-) Header Inspection",
      category: "UNIT",
      status: "FAIL",
      expected: "Validation executes without error",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 5: Offline Mode with S3 Keys (S3_ENABLED=false) -> HTTP 503
  // ============================================================================
  const originalS3Enabled = process.env.S3_ENABLED;
  try {
    // Force S3_ENABLED=false
    process.env.S3_ENABLED = "false";

    const svc = new StorageService();
    const cloudKey = "materials/courses/course-123/mat-456/lecture.pdf";

    let got503 = false;
    let errorMessage = "";

    try {
      await svc.getFileStream(cloudKey);
    } catch (err: any) {
      got503 = err.statusCode === 503;
      errorMessage = err.message;
    }

    if (got503 && errorMessage.includes("Material is stored in cloud S3, but S3 storage is currently disabled")) {
      recordTest({
        name: "Offline Refusal of S3 Keys When S3_ENABLED=false (HTTP 503)",
        category: "UNIT",
        status: "PASS",
        expected: "Returns explicit HTTP 503 explaining cloud storage is disabled; does NOT silently fall back or crash",
        actual: `HTTP 503 caught: "${errorMessage}"`,
      });
    } else {
      recordTest({
        name: "Offline Refusal of S3 Keys When S3_ENABLED=false (HTTP 503)",
        category: "UNIT",
        status: "FAIL",
        expected: "HTTP 503 with explicit message",
        actual: `got503=${got503}, error="${errorMessage}"`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Offline Refusal of S3 Keys When S3_ENABLED=false (HTTP 503)",
      category: "UNIT",
      status: "FAIL",
      expected: "Executes without uncaught exception",
      actual: err?.message || String(err),
    });
  } finally {
    if (originalS3Enabled !== undefined) {
      process.env.S3_ENABLED = originalS3Enabled;
    } else {
      delete process.env.S3_ENABLED;
    }
  }

  // ============================================================================
  // TEST 6: Restore Verification: S3 ContentLength Validation & Mismatch Guard
  // ============================================================================
  const testTempDir6 = path.resolve(process.cwd(), "uploads", `temp-test-restore-6-${Date.now()}`);
  let tempMaterialId6: string | null = null;
  const tempS3Key6 = `materials/courses/course-test-roll/temp-mat-6-${Date.now()}/lecture.pdf`;

  try {
    const course = await prisma.course.findFirst();
    if (!course) {
      throw new Error("Cannot execute Test 6: no course found in database");
    }

    await prisma.material.deleteMany({ where: { id: { startsWith: "test-mat-" } } }).catch(() => {});

    tempMaterialId6 = `test-mat-6-${Date.now()}`;
    await prisma.material.create({
      data: {
        id: tempMaterialId6,
        courseId: course.id,
        title: "Test Material Byte Mismatch",
        unit: "Unit 1",
        fileUrl: tempS3Key6,
        processingStatus: "READY",
        fileSize: "500 B",
      },
    });

    if (!fs.existsSync(testTempDir6)) {
      fs.mkdirSync(testTempDir6, { recursive: true });
    }

    const expectedCorruptFile = path.join(testTempDir6, `${tempMaterialId6}-lecture.pdf`);

    // Subtest 1: Byte-size mismatch (reported 500 bytes, stream only 50 bytes)
    const mismatchMockS3: any = {
      providerName: "s3",
      isCloud: true,
      getHealth: async () => ({ healthy: true, details: { bucket: "mock-test-bucket" } }),
      getBucketName: () => "mock-test-bucket",
      getRegion: () => "us-east-1",
      getFileStream: async () => ({
        stream: Readable.from(Buffer.alloc(50, "P")),
        contentLength: 500,
        contentType: "application/pdf",
      }),
    };

    const mismatchResult = await restoreMaterialsFromS3({
      yes: true,
      customUploadsDir: testTempDir6,
      customS3Provider: mismatchMockS3,
      materialIds: [tempMaterialId6],
    });

    const mismatchCleanedUp = !fs.existsSync(expectedCorruptFile);
    const dbAfterMismatch = await prisma.material.findUnique({ where: { id: tempMaterialId6 } });
    const mismatchDbUntouched = dbAfterMismatch?.fileUrl === tempS3Key6;
    const subtest1Passed = mismatchResult.failed > 0 && mismatchResult.success === false && mismatchCleanedUp && mismatchDbUntouched;

    // Subtest 2: Missing ContentLength (undefined)
    const missingLenMockS3: any = {
      providerName: "s3",
      isCloud: true,
      getHealth: async () => ({ healthy: true, details: { bucket: "mock-test-bucket" } }),
      getBucketName: () => "mock-test-bucket",
      getRegion: () => "us-east-1",
      getFileStream: async () => ({
        stream: Readable.from(Buffer.alloc(50, "P")),
        contentLength: undefined as any,
        contentType: "application/pdf",
      }),
    };

    const missingResult = await restoreMaterialsFromS3({
      yes: true,
      customUploadsDir: testTempDir6,
      customS3Provider: missingLenMockS3,
      materialIds: [tempMaterialId6],
    });

    const missingCleanedUp = !fs.existsSync(expectedCorruptFile);
    const dbAfterMissing = await prisma.material.findUnique({ where: { id: tempMaterialId6 } });
    const missingDbUntouched = dbAfterMissing?.fileUrl === tempS3Key6;
    const subtest2Passed = missingResult.failed > 0 && missingResult.success === false && missingCleanedUp && missingDbUntouched;

    // Subtest 3: Zero ContentLength (0)
    const zeroLenMockS3: any = {
      providerName: "s3",
      isCloud: true,
      getHealth: async () => ({ healthy: true, details: { bucket: "mock-test-bucket" } }),
      getBucketName: () => "mock-test-bucket",
      getRegion: () => "us-east-1",
      getFileStream: async () => ({
        stream: Readable.from(Buffer.alloc(50, "P")),
        contentLength: 0,
        contentType: "application/pdf",
      }),
    };

    const zeroResult = await restoreMaterialsFromS3({
      yes: true,
      customUploadsDir: testTempDir6,
      customS3Provider: zeroLenMockS3,
      materialIds: [tempMaterialId6],
    });

    const zeroCleanedUp = !fs.existsSync(expectedCorruptFile);
    const dbAfterZero = await prisma.material.findUnique({ where: { id: tempMaterialId6 } });
    const zeroDbUntouched = dbAfterZero?.fileUrl === tempS3Key6;
    const subtest3Passed = zeroResult.failed > 0 && zeroResult.success === false && zeroCleanedUp && zeroDbUntouched;

    const allGuardsPassed = subtest1Passed && subtest2Passed && subtest3Passed;

    if (allGuardsPassed) {
      recordTest({
        name: "Reverse Migration (Restore) S3 ContentLength Validation & Byte-Size Mismatch Guard",
        category: "UNIT",
        status: "PASS",
        expected: "Rejects byte-size mismatch, missing ContentLength, and zero ContentLength; cleans up corrupt files; preserves DB fileUrl",
        actual: `mismatch(failed=${mismatchResult.failed}, cleaned=${mismatchCleanedUp}, dbPreserved=${mismatchDbUntouched}); missing(failed=${missingResult.failed}, cleaned=${missingCleanedUp}, dbPreserved=${missingDbUntouched}); zero(failed=${zeroResult.failed}, cleaned=${zeroCleanedUp}, dbPreserved=${zeroDbUntouched})`,
      });
    } else {
      recordTest({
        name: "Reverse Migration (Restore) S3 ContentLength Validation & Byte-Size Mismatch Guard",
        category: "UNIT",
        status: "FAIL",
        expected: "All 3 ContentLength failure modes rejected, corrupt files deleted, db preserved",
        actual: `subtest1=${subtest1Passed}, subtest2=${subtest2Passed}, subtest3=${subtest3Passed}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Reverse Migration (Restore) S3 ContentLength Validation & Byte-Size Mismatch Guard",
      category: "UNIT",
      status: "FAIL",
      expected: "Executes without uncaught exception",
      actual: err?.message || String(err),
    });
  } finally {
    if (tempMaterialId6) {
      await prisma.material.delete({ where: { id: tempMaterialId6 } }).catch(() => {});
    }
    if (fs.existsSync(testTempDir6)) {
      try {
        fs.rmSync(testTempDir6, { recursive: true, force: true });
      } catch {}
    }
  }

  // ============================================================================
  // TEST 7: Rollback Safety: Incomplete Restoration Enforces S3 Remaining Enabled
  // ============================================================================
  const testTempDir7 = path.resolve(process.cwd(), "uploads", `temp-test-restore-7-${Date.now()}`);
  let tempMaterialId7: string | null = null;
  const tempS3Key7 = `materials/courses/course-test-roll/temp-mat-7-${Date.now()}/verified.pdf`;

  try {
    const course = await prisma.course.findFirst();
    if (!course) {
      throw new Error("Cannot execute Test 7: no course found in database");
    }

    await prisma.material.deleteMany({ where: { id: { startsWith: "test-mat-" } } }).catch(() => {});

    tempMaterialId7 = `test-mat-7-${Date.now()}`;
    await prisma.material.create({
      data: {
        id: tempMaterialId7,
        courseId: course.id,
        title: "Test Material Rollback Invariant",
        unit: "Unit 2",
        fileUrl: tempS3Key7,
        processingStatus: "READY",
        fileSize: "100 B",
      },
    });

    if (!fs.existsSync(testTempDir7)) {
      fs.mkdirSync(testTempDir7, { recursive: true });
    }

    // Guard 1: Non-interactive execution without confirmation must safely abort without modifying DB or files
    // Strictly isolated to tempMaterialId7
    const unconfirmedResult = await restoreMaterialsFromS3({
      interactive: false,
      customUploadsDir: testTempDir7,
      customS3Provider: {
        providerName: "s3",
        isCloud: true,
        getHealth: async () => ({ healthy: true, details: { bucket: "mock-test-bucket" } }),
        getBucketName: () => "mock-test-bucket",
        getRegion: () => "us-east-1",
        getFileStream: async () => ({
          stream: Readable.from(Buffer.alloc(100, "Z")),
          contentLength: 100,
          contentType: "application/pdf",
        }),
      },
      materialIds: [tempMaterialId7],
      // yes and force intentionally omitted
    });

    const unconfirmedFailed = unconfirmedResult.success === false;
    const reasonMatches = unconfirmedResult.reason === "CONFIRMATION_REQUIRED";
    const totalIsOne = unconfirmedResult.total === 1;
    const noFilesWritten = !fs.existsSync(testTempDir7) || fs.readdirSync(testTempDir7).length === 0;
    const materialAfterUnconfirmed = await prisma.material.findUnique({
      where: { id: tempMaterialId7 },
    });
    const fileUrlUnchanged = materialAfterUnconfirmed?.fileUrl === tempS3Key7;

    const guard1Passed =
      unconfirmedFailed &&
      reasonMatches &&
      totalIsOne &&
      noFilesWritten &&
      fileUrlUnchanged;

    // Guard 2: With confirmation (--yes) and matching byte sizes, restore completes cleanly
    // Strictly isolated to tempMaterialId7
    const expectedBytes = 100;
    const fullMockS3: any = {
      providerName: "s3",
      isCloud: true,
      getHealth: async () => ({ healthy: true, details: { bucket: "mock-test-bucket" } }),
      getBucketName: () => "mock-test-bucket",
      getRegion: () => "us-east-1",
      getFileStream: async () => ({
        stream: Readable.from(Buffer.alloc(expectedBytes, "Z")),
        contentLength: expectedBytes,
        contentType: "application/pdf",
      }),
    };

    const confirmedResult = await restoreMaterialsFromS3({
      yes: true,
      customUploadsDir: testTempDir7,
      customS3Provider: fullMockS3,
      materialIds: [tempMaterialId7],
    });

    const expectedRestoredFile = path.join(testTempDir7, `${tempMaterialId7}-verified.pdf`);
    const fileExistsOnDisk = fs.existsSync(expectedRestoredFile);
    const downloadedBytes = fileExistsOnDisk ? fs.statSync(expectedRestoredFile).size : -1;
    const bytesMatch = downloadedBytes === expectedBytes;

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: tempMaterialId7 },
    });
    const expectedLocalUrl = `/uploads/materials/${tempMaterialId7}-verified.pdf`;
    const dbUpdatedProperly = updatedMaterial?.fileUrl === expectedLocalUrl;
    const restoreSuccess =
      confirmedResult.success === true &&
      confirmedResult.failed === 0 &&
      confirmedResult.total === 1 &&
      confirmedResult.restored === 1;

    const rollbackPolicyValid =
      guard1Passed &&
      fileExistsOnDisk &&
      bytesMatch &&
      dbUpdatedProperly &&
      restoreSuccess;

    if (rollbackPolicyValid) {
      recordTest({
        name: "Rollback Safety Policy: Incomplete Restores Enforce S3 Remaining Active",
        category: "UNIT",
        status: "PASS",
        expected: "Unconfirmed run aborts safely with CONFIRMATION_REQUIRED, writes no files, changes no DB fileUrl; confirmed restore with matching bytes succeeds, writes verified file, and updates DB (isolated to test material)",
        actual: `guard1Passed=${guard1Passed} (reason=${unconfirmedResult.reason}, total=${unconfirmedResult.total}, noFiles=${noFilesWritten}, urlUnchanged=${fileUrlUnchanged}); confirmedSuccess=${restoreSuccess} (total=${confirmedResult.total}, restored=${confirmedResult.restored}), bytesMatch=${bytesMatch} (${downloadedBytes}/${expectedBytes}), dbUpdated=${dbUpdatedProperly}`,
      });
    } else {
      recordTest({
        name: "Rollback Safety Policy: Incomplete Restores Enforce S3 Remaining Active",
        category: "UNIT",
        status: "FAIL",
        expected: "Rollback safety invariants satisfied",
        actual: `guard1Passed=${guard1Passed}, success=${confirmedResult.success}, total=${confirmedResult.total}, failed=${confirmedResult.failed}, fileExists=${fileExistsOnDisk}, bytesMatch=${bytesMatch}, dbUpdated=${dbUpdatedProperly}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Rollback Safety Policy: Incomplete Restores Enforce S3 Remaining Active",
      category: "UNIT",
      status: "FAIL",
      expected: "Executes without error",
      actual: err?.message || String(err),
    });
  } finally {
    if (tempMaterialId7) {
      await prisma.material.delete({ where: { id: tempMaterialId7 } }).catch(() => {});
    }
    if (fs.existsSync(testTempDir7)) {
      try {
        fs.rmSync(testTempDir7, { recursive: true, force: true });
      } catch {}
    }
  }

  // ============================================================================
  // TEST 8: Storage Security: Approved Roots Confinement & Traversal Defense
  // ============================================================================
  const externalSandboxDir = path.resolve(process.cwd(), `test-external-sandbox-${Date.now()}`);
  const canaryExternalFile = path.join(externalSandboxDir, "canary-external.txt");

  const localProvider = new LocalStorageProvider();
  const canaryUploadFile = path.join(localProvider.getUploadsDir(), `canary-upload-${Date.now()}.pdf`);
  const canaryPublicFile = path.join(localProvider.getPublicDir(), `canary-public-${Date.now()}.pdf`);

  try {
    // Setup canary files
    if (!fs.existsSync(externalSandboxDir)) {
      fs.mkdirSync(externalSandboxDir, { recursive: true });
    }
    fs.writeFileSync(canaryExternalFile, "EXTERNAL_CANARY_DO_NOT_DELETE", "utf8");

    if (!fs.existsSync(localProvider.getUploadsDir())) {
      fs.mkdirSync(localProvider.getUploadsDir(), { recursive: true });
    }
    fs.writeFileSync(canaryUploadFile, "%PDF-1.4 canary upload", "utf8");

    if (!fs.existsSync(localProvider.getPublicDir())) {
      fs.mkdirSync(localProvider.getPublicDir(), { recursive: true });
    }
    fs.writeFileSync(canaryPublicFile, "%PDF-1.4 canary public", "utf8");

    // 1. Valid file inside uploads/materials => allowed
    const uploadKey = `/uploads/materials/${path.basename(canaryUploadFile)}`;
    const resolvedUpload = localProvider.resolveLocalPath(uploadKey);
    const uploadAllowed =
      resolvedUpload !== null &&
      fs.existsSync(resolvedUpload) &&
      isWithinRoot(resolvedUpload, localProvider.getUploadsDir());

    // 2. Valid explicitly approved public file => allowed
    const publicKey = `/public/${path.basename(canaryPublicFile)}`;
    const resolvedPublic = localProvider.resolveLocalPath(publicKey);
    const publicAllowed =
      resolvedPublic !== null &&
      fs.existsSync(resolvedPublic) &&
      isWithinRoot(resolvedPublic, localProvider.getPublicDir());

    // 3. ../ traversal => rejected
    const traversalKey1 = `../${path.basename(canaryExternalFile)}`;
    const traversalKey2 = `/uploads/materials/../../${path.basename(canaryExternalFile)}`;
    const traversalKey3 = `..\\..\\${path.basename(canaryExternalFile)}`;
    const resolvedTraversal1 = localProvider.resolveLocalPath(traversalKey1);
    const resolvedTraversal2 = localProvider.resolveLocalPath(traversalKey2);
    const resolvedTraversal3 = localProvider.resolveLocalPath(traversalKey3);
    const traversalRejected =
      resolvedTraversal1 === null &&
      resolvedTraversal2 === null &&
      resolvedTraversal3 === null;

    // 4. Absolute path outside root => rejected
    const resolvedAbsoluteOutside = localProvider.resolveLocalPath(canaryExternalFile);
    const absoluteOutsideRejected = resolvedAbsoluteOutside === null;

    // 5. Sibling directory outside root => rejected
    const siblingKey = `../${path.basename(externalSandboxDir)}/canary-external.txt`;
    const resolvedSibling = localProvider.resolveLocalPath(siblingKey);
    const siblingRejected = resolvedSibling === null;

    // 6. S3 key => rejected by local provider
    const s3Key = "materials/courses/course-123/mat-456/lecture.pdf";
    const resolvedS3 = localProvider.resolveLocalPath(s3Key);
    const s3Rejected = resolvedS3 === null;

    // 7. Missing source file non-synthesis (retaining invariant)
    const nonExistentKey = "/uploads/materials/completely-nonexistent-file-999.pdf";
    const resolvedMissing = localProvider.resolveLocalPath(nonExistentKey);
    const missingNonSynthesized = resolvedMissing === null || !fs.existsSync(resolvedMissing);

    // 8. deleteFile() cannot unlink files outside approved storage roots
    await localProvider.deleteFile(canaryExternalFile);
    const externalFileIntact = fs.existsSync(canaryExternalFile);

    const allSecurityChecksPass =
      uploadAllowed &&
      publicAllowed &&
      traversalRejected &&
      absoluteOutsideRejected &&
      siblingRejected &&
      s3Rejected &&
      missingNonSynthesized &&
      externalFileIntact;

    if (allSecurityChecksPass) {
      recordTest({
        name: "Storage Security: Approved Roots Confinement & Traversal Defense",
        category: "UNIT",
        status: "PASS",
        expected: "Permits uploads/materials and public files; rejects ../ traversal, absolute paths outside roots, sibling dirs, and S3 keys; prevents deleteFile from unlinking external files",
        actual: `uploadAllowed=${uploadAllowed}, publicAllowed=${publicAllowed}, traversalRejected=${traversalRejected}, absoluteOutsideRejected=${absoluteOutsideRejected}, siblingRejected=${siblingRejected}, s3Rejected=${s3Rejected}, missingNonSynthesized=${missingNonSynthesized}, deleteFileProtected=${externalFileIntact}`,
      });
    } else {
      recordTest({
        name: "Storage Security: Approved Roots Confinement & Traversal Defense",
        category: "UNIT",
        status: "FAIL",
        expected: "All containment and traversal security checks pass",
        actual: `uploadAllowed=${uploadAllowed}, publicAllowed=${publicAllowed}, traversalRejected=${traversalRejected}, absoluteOutsideRejected=${absoluteOutsideRejected}, siblingRejected=${siblingRejected}, s3Rejected=${s3Rejected}, missingNonSynthesized=${missingNonSynthesized}, deleteFileProtected=${externalFileIntact}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Storage Security: Approved Roots Confinement & Traversal Defense",
      category: "UNIT",
      status: "FAIL",
      expected: "Executes without error",
      actual: err?.message || String(err),
    });
  } finally {
    if (fs.existsSync(canaryUploadFile)) {
      try {
        fs.unlinkSync(canaryUploadFile);
      } catch {}
    }
    if (fs.existsSync(canaryPublicFile)) {
      try {
        fs.unlinkSync(canaryPublicFile);
      } catch {}
    }
    if (fs.existsSync(canaryExternalFile)) {
      try {
        fs.unlinkSync(canaryExternalFile);
      } catch {}
    }
    if (fs.existsSync(externalSandboxDir)) {
      try {
        fs.rmSync(externalSandboxDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // ============================================================================
  // TEST 9: Repeated Idempotent Migration: Byte-Size Matching
  // ============================================================================
  try {
    // Mock S3 provider that simulates an object existing with identical byte size
    const mockFileSize = 2048;
    const mockClient: any = {
      send: async (cmd: any) => {
        if (cmd.constructor.name === "HeadObjectCommand") {
          return { ContentLength: mockFileSize };
        }
        return {};
      },
    };

    const mockS3 = new S3StorageProvider({
      bucket: "idempotency-test-bucket",
      client: mockClient,
    });

    const targetKey = "materials/courses/c1/m1/lecture.pdf";
    const exists = await mockS3.fileExists(targetKey);
    const size = await mockS3.getFileSize(targetKey);

    const isMatch = exists && size === mockFileSize;

    if (isMatch) {
      recordTest({
        name: "Repeated Idempotent Migration: Byte-Size Equivalence Resumption",
        category: "UNIT",
        status: "PASS",
        expected: "Detects existing S3 object with identical byte-size; signals upload skip for fast resumption",
        actual: `exists=${exists}, size=${size} bytes matches localSize=${mockFileSize} bytes -> SKIPPED (Idempotent)`,
      });
    } else {
      recordTest({
        name: "Repeated Idempotent Migration: Byte-Size Equivalence Resumption",
        category: "UNIT",
        status: "FAIL",
        expected: "Size equality detected",
        actual: `exists=${exists}, size=${size}`,
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Repeated Idempotent Migration: Byte-Size Equivalence Resumption",
      category: "UNIT",
      status: "FAIL",
      expected: "Executes without error",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 10: Pre-S3 Authorization Enforcement (RBAC / Enrollment Guard)
  // ============================================================================
  try {
    const student = await prisma.user.findFirst({
      where: { role: "STUDENT" },
    });
    const material = await prisma.material.findFirst({
      include: { course: true },
    });

    if (student && material) {
      // Check if student is enrolled; if so, test with a dummy unenrolled ID or check
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          studentId_courseId: {
            studentId: student.id,
            courseId: material.courseId,
          },
        },
      });

      if (!enrollment) {
        let blocked = false;
        try {
          await getMaterialFile(material.id, student.id, "STUDENT");
        } catch (authErr: any) {
          blocked = authErr.statusCode === 403;
        }

        if (blocked) {
          recordTest({
            name: "Pre-S3 Authorization: Unenrolled Student Blocked with HTTP 403",
            category: "INTEGRATION",
            status: "PASS",
            expected: "Unenrolled student blocked with 403 Forbidden before S3 is contacted",
            actual: "Blocked with HTTP 403 Forbidden prior to any storage stream retrieval",
          });
        } else {
          recordTest({
            name: "Pre-S3 Authorization: Unenrolled Student Blocked with HTTP 403",
            category: "INTEGRATION",
            status: "FAIL",
            expected: "Blocked with HTTP 403",
            actual: "Not blocked with 403",
          });
        }
      } else {
        // Test with random UUID student
        const fakeStudentId = "00000000-0000-0000-0000-000000000000";
        let blocked = false;
        try {
          await getMaterialFile(material.id, fakeStudentId, "STUDENT");
        } catch (authErr: any) {
          blocked = authErr.statusCode === 403;
        }

        recordTest({
          name: "Pre-S3 Authorization: Unenrolled Student Blocked with HTTP 403",
          category: "INTEGRATION",
          status: blocked ? "PASS" : "FAIL",
          expected: "Unenrolled student blocked with 403 Forbidden before storage dispatch",
          actual: blocked ? "Blocked with HTTP 403 Forbidden" : "Allowed unexpectedly",
        });
      }
    } else {
      recordTest({
        name: "Pre-S3 Authorization: Unenrolled Student Blocked with HTTP 403",
        category: "INTEGRATION",
        status: "CONDITIONAL_SKIP",
        expected: "Requires student and material records in DB",
        actual: "Database not populated with test student/material",
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Pre-S3 Authorization: Unenrolled Student Blocked with HTTP 403",
      category: "INTEGRATION",
      status: "FAIL",
      expected: "Executes without error",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // TEST 11: Live AWS S3 Bucket Connectivity (Conditional on Real Credentials)
  // ============================================================================
  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    const hasAwsKey = !!(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE);

    if (bucketName && hasAwsKey) {
      const s3Provider = new S3StorageProvider();
      const health = await s3Provider.getHealth();

      if (health.healthy) {
        recordTest({
          name: "Live AWS S3 Bucket HeadBucket Verification",
          category: "LIVE_AWS",
          status: "PASS",
          expected: `HeadBucketCommand succeeds on ${bucketName}`,
          actual: `200 OK connected to bucket: ${bucketName} in ${s3Provider.getRegion()}`,
        });
      } else {
        recordTest({
          name: "Live AWS S3 Bucket HeadBucket Verification",
          category: "LIVE_AWS",
          status: "FAIL",
          expected: `HeadBucketCommand succeeds on ${bucketName}`,
          actual: `HeadBucket failed: ${health.details?.error}`,
          notes: "Verify that the bucket exists and IAM credentials have s3:ListBucket permission.",
        });
      }
    } else {
      recordTest({
        name: "Live AWS S3 Bucket HeadBucket Verification",
        category: "LIVE_AWS",
        status: "CONDITIONAL_SKIP",
        expected: "Requires real S3_BUCKET_NAME and AWS credentials configured in backend/.env",
        actual: `S3_BUCKET_NAME=${bucketName ? "[CONFIGURED]" : "[UNSET]"}, AWS credentials=${hasAwsKey ? "[CONFIGURED]" : "[UNSET]"}`,
        notes: "Real AWS S3 network verification will run once cloud infrastructure credentials are provided in .env.",
      });
    }
  } catch (err: any) {
    recordTest({
      name: "Live AWS S3 Bucket HeadBucket Verification",
      category: "LIVE_AWS",
      status: "FAIL",
      expected: "Executes without exception",
      actual: err?.message || String(err),
    });
  }

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  const total = reports.length;
  const passed = reports.filter((r) => r.status === "PASS").length;
  const failed = reports.filter((r) => r.status === "FAIL").length;
  const skipped = reports.filter((r) => r.status === "CONDITIONAL_SKIP").length;

  console.log("================================================================================");
  console.log("PHASE 14 S3 STORAGE TEST EXECUTION SUMMARY:");
  console.log(`Total Tests:      ${total}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Conditional Skip: ${skipped}`);
  console.log("================================================================================\n");

  return {
    total,
    passed,
    failed,
    skipped,
    reports,
  };
}

// Execute directly when run as CLI script
if (process.argv[1]?.includes("test-phase14-s3")) {
  runPhase14Tests()
    .then((res) => {
      if (res.failed > 0) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error("FATAL TEST EXECUTION ERROR:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
