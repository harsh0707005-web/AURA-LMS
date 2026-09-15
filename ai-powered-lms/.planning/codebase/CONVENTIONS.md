# Coding Conventions & Development Patterns

This document outlines the coding standards, design patterns, architectural conventions, and error-handling paradigms enforced across **AURA LMS**.

---

## 1. Module Systems & File Naming

### Backend ES Modules (Node.js ESM)
- **Module Format**: Set to `"type": "module"` in [`backend/package.json`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/package.json).
- **Import Extensions**: All relative module imports in backend TypeScript files **must** explicitly specify the `.js` extension (e.g., `import prisma from "../lib/prisma.js";`). TypeScript compiles these seamlessly into ES module imports.
- **Naming Pattern**:
  - Routes: `<resource>.routes.ts` (e.g., `course.routes.ts`, `ai.routes.ts`)
  - Controllers: `<resource>.controller.ts` (e.g., `course.controller.ts`, `material.controller.ts`)
  - Services: `<resource>.service.ts` (e.g., `rag.service.ts`, `quiz.service.ts`)
  - Middleware: `<functionality>.middleware.ts` (e.g., `auth.middleware.ts`, `role.middleware.ts`)

### Frontend Next.js Components
- **Components**: PascalCase matching component name (e.g., `DashboardShell.tsx`, `AIChatBox.tsx`, `PDFViewerModal.tsx`).
- **App Router Pages**: Strictly named `page.tsx` within semantic subdirectories (e.g., `app/student/courses/[id]/page.tsx`).
- **Client Directive**: Any component using React hooks (`useState`, `useEffect`, `useRef`), browser APIs, or interactive event listeners must begin with `"use client";` as the first line.

---

## 2. API Response Formatting & HTTP Status Codes

### Standard API Response Envelope
All backend endpoints return a standardized JSON structure:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable confirmation"
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Descriptive error message",
  "error": "Optional system error details (dev mode)"
}
```

### HTTP Status Code Conventions
| Status Code | Usage in AURA LMS |
| :--- | :--- |
| `200 OK` | Successful resource retrieval, update, or deletion |
| `201 Created` | Successful creation (new account, course, material, quiz attempt, conversation message) |
| `400 Bad Request` | Missing required payload parameters, invalid data types, or public admin registration attempt |
| `401 Unauthorized` | Missing, malformed, or expired Bearer JWT token |
| `403 Forbidden` | Insufficient role permissions or IDOR student ownership violation |
| `404 Not Found` | Requested course, material, quiz, or user does not exist |
| `409 Conflict` | Duplicate email during registration, or duplicate course enrollment |
| `422 Unprocessable Entity` | PDF file uploaded contains no extractable text (e.g., scanned image) |
| `500 Internal Server Error` | Uncaught server exception |
| `503 Service Unavailable` | Database unreachable or Gemini API key missing |

---

## 3. Error Handling Architecture

### Backend Error Pattern
Services throw standard JavaScript errors enriched with an HTTP `statusCode` property:
```typescript
throw Object.assign(new Error("Material not found"), { statusCode: 404 });
```

The centralized error middleware [`backend/src/middleware/error.middleware.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/middleware/error.middleware.ts) intercepts all unhandled errors:
```typescript
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}
```

### Frontend Error Interception
The `apiRequest()` client extracts `data.message` from failed HTTP responses and throws an `Error(data.message)`. Calling components catch this error and surface contextual alert banners (e.g., in `AIChatBox.tsx` and `PDFViewerModal.tsx`).

---

## 4. Database & ORM Conventions

### Prisma Schema Standards
- **Model Names**: PascalCase singular (`User`, `Course`, `MaterialProgress`).
- **Primary Keys**: UUID v4 strings (`id String @id @default(uuid())`).
- **Timestamps**: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- **Foreign Keys**: CamelCase with `Id` suffix (e.g., `courseId`, `studentId`, `facultyId`).
- **Cascade Deletions**: Related dependent entities configure `onDelete: Cascade` (e.g., deleting a Course cascades to Materials, Quizzes, Assignments, and Enrollments).

### Raw pgvector SQL Queries
Because Prisma ORM does not yet natively generate type-safe pgvector similarity operators (`<=>`), all vector operations utilize `prisma.$queryRawUnsafe` or `prisma.$executeRawUnsafe`.
- Explicit parameterization (`$1`, `$2`, `$3`) is used to prevent SQL injection.
- Vector array literals are safely serialized via `embeddingService.toVectorLiteral(vector)`.
- PostgreSQL column identifiers with uppercase characters are wrapped in double quotes (e.g., `dc."materialId"`, `dc."pageNumber"`).

---

## 5. Security & Privacy Conventions

### Zero-PII Policy in AI Prompts
When assembling academic prompts for Google Gemini in [`backend/src/services/ai/student-context.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/ai/student-context.service.ts):
- Student personal identity markers (`name`, `email`, `enrollmentNo`, `id`, `avatarUrl`) are **strictly excluded**.
- Only pedagogical data is injected: academic level, syllabus weak topics from quiz attempts, course progress percentage, and recommended study items.

### Password Sanitization
- Passwords are never stored in plaintext and are hashed using bcrypt with salt rounds of 10.
- User objects returned across API responses are sanitized using `sanitizeUser()` in [`backend/src/services/auth.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/auth.service.ts), stripping `passwordHash`.

### IDOR Isolation Guard
- Student routes enforce `authorizeStudentAccess("id")` in [`backend/src/middleware/role.middleware.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/middleware/role.middleware.ts). A student can only request records matching their own authenticated `userId`.
