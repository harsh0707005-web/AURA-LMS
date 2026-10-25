# AURA LMS — Backend API Documentation

**AI-powered University Resource & Academic Learning System**  
Department of Computer Engineering • Final Year Capstone Project

Base URL: `http://localhost:5000/api`

---

## 1. Environment & RAG Configuration

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | `postgresql://...` | PostgreSQL connection string |
| `FRONTEND_URL` | URL | `http://localhost:3000` | Allowed frontend origin; must be HTTPS and origin-only in production |
| `JWT_SECRET` | String | *Required* | Secret for signing HS256 auth tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | Duration | `15m` | Access-token lifetime; production requires an explicit value no longer than one hour |
| `GEMINI_API_KEY` | String | *Required* | Google Gemini API key (backend only) |
| `GEMINI_EMBEDDING_MODEL` | String | `gemini-embedding-001` | 3072-dimensional vector embedding model |
| `GEMINI_GENERATION_MODEL` | String | `gemini-3.7-flash` | Primary grounded academic completion model; Gemini model fallbacks are reported separately |
| `GEMINI_FALLBACK_MODELS` | CSV | built-in Gemini fallback list | Optional ordered fallback models; fallback is recorded in telemetry |
| `GEMINI_THINKING_BUDGET` | Number | `0` | Thinking budget for normal tutor requests |
| `GEMINI_COMPLEX_THINKING_BUDGET` | Number | `1024` | Thinking budget for proof/derivation requests |
| `GEMINI_REQUEST_TIMEOUT_MS` | Number | `45000` | Per-network-attempt Gemini timeout (the SDK requires at least 10 seconds) |
| `GEMINI_EMBEDDING_BUDGET_MS` | Number | `30000` | Total embedding budget across embedding retries |
| `GEMINI_GENERATION_BUDGET_MS` | Number | `90000` | Total normal tutor-generation budget across Gemini retries/fallbacks and optional Groq failover |
| `GEMINI_COMPLEX_GENERATION_BUDGET_MS` | Number | `120000` | Total complex tutor-generation budget |
| `GEMINI_MAX_ATTEMPTS_PER_MODEL` | Number | `1` | Maximum attempts for one generation model; fallback models remain available |
| `GEMINI_MAX_TOTAL_ATTEMPTS` | Number | `4` | Maximum generation attempts across the fallback chain |
| `GEMINI_TUTOR_MAX_OUTPUT_TOKENS` | Number | `1200` | Conservative output cap for normal tutor answers |
| `GEMINI_TUTOR_COMPLEX_MAX_OUTPUT_TOKENS` | Number | `1600` | Output cap for complex tutor answers |
| `DEFAULT_LLM_PROVIDER` | String | `gemini` | Active completion provider; with Gemini selected, Groq is an optional generation-only failover |
| `GROQ_API_KEY` | String | *Unset* | Optional Groq credential; when set, tutor generation can fail over to Groq after Gemini fails |
| `GROQ_MODEL` | String | `openai/gpt-oss-20b` | Optional Groq completion model |
| `GROQ_API_URL` | String | Groq chat-completions endpoint | Optional OpenAI-compatible endpoint override |
| `GROQ_TIMEOUT_MS` | Number | `30000` | Per-attempt Groq timeout |
| `S3_ENABLED` | Boolean | `false` | Selects S3-compatible storage; must be `true` in production |
| `S3_BUCKET_NAME` | String | *Unset* | Canonical S3-compatible bucket name |
| `S3_REGION` | String | `us-east-1` | Canonical S3-compatible region |
| `S3_ENDPOINT` | URL | *Unset* | Optional S3-compatible endpoint override |
| `S3_FORCE_PATH_STYLE` | Boolean | `false` | Use path-style requests for compatible providers |
| `S3_DELIVERY_MODE` | String | `proxy` | Protected backend proxy delivery mode |
| `RAG_TOP_K` | Number | `5` | Maximum number of chunks to retrieve |
| `RAG_MIN_SIMILARITY` | Number | `0.55` | Minimum cosine similarity threshold (1 - distance) |
| `RAG_MAX_CONTEXT_CHARS` | Number | `10000` | Maximum retrieved-context characters sent to the tutor |
| `RAG_MAX_HISTORY_CHARS` | Number | `4000` | Maximum conversation-history characters sent to the tutor |

The frontend uses `NEXT_PUBLIC_API_URL` for the backend base URL and an optional `NEXT_PUBLIC_AI_REQUEST_TIMEOUT_MS` client abort window. The default client window is `125000` ms and does not change server-side provider budgets. `AI_MESSAGE_WORKFLOW_TIMEOUT_MS` controls the durable AI-message workflow deadline and defaults to `120000` ms. A browser disconnect does not cancel server-side processing; clients should reconcile through the idempotency-key status endpoint.

When `DEFAULT_LLM_PROVIDER=gemini` and `GROQ_API_KEY` is configured, Gemini remains the primary completion provider. Groq is attempted only after Gemini generation and its configured Gemini model fallback chain fail. Gemini continues to provide embeddings, and the retrieved course context, grounding threshold, citations, and personalization are unchanged. If Groq is unavailable, the existing Gemini-only behavior is preserved.

---

## 2. System Health Endpoints

### `GET /api/health`
- **Description**: Returns operational status of the Express server.
- **Access**: Public

### `GET /api/health/db`
- **Description**: Verifies PostgreSQL connectivity and returns user/course counts.
- **Access**: Public

---

## 3. Institution-Controlled Registration

Public registration never creates an administrator account and never grants `FACULTY` directly.

### Student registration

`POST /api/auth/register` accepts an application type rather than an authorization role:

```json
{
  "name": "Approved Student",
  "email": "student@college.edu",
  "password": "Password123",
  "accountType": "STUDENT",
  "enrollmentNo": "BE-2024-CS-001",
  "department": "Computer Engineering"
}
```

The enrollment number and normalized email must already exist together in the administrator-managed `StudentRegistry`, and the row must be active and unclaimed. The account remains pending until email verification completes.

### Faculty application

Use the same endpoint with `accountType: "FACULTY"` and an `employeeId`. The account is stored as a pending application and cannot log in or access faculty resources until an active administrator approves it.

### Email verification

`POST /api/auth/verify-email` with `{ "token": "<raw token>" }` activates an eligible student account. Tokens are hashed at rest, expire after 24 hours, and are single-use. If no email provider is configured, registration remains pending and no verification token is returned by the API.

`POST /api/auth/resend-verification` accepts `{ "email": "student@college.edu" }` and returns a generic response to reduce account enumeration.

### Administrator provisioning and review

An initial administrator must be created through the existing restricted seed or operational provisioning process; there is no public administrator bootstrap endpoint.

After signing in as an active administrator:

- `POST /api/admin/student-registry/import` imports approved records as `{ "records": [{ "enrollmentNo": "...", "email": "...", "active": true }] }`.
- `GET /api/admin/faculty-applications` lists applications for review.
- `POST /api/admin/faculty-applications/:id/approve` activates the validated applicant as `FACULTY`.
- `POST /api/admin/faculty-applications/:id/reject` rejects the application.

Required backend environment variables for real email delivery are `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM`, and a secure `FRONTEND_URL`. The token is sent in a URL fragment so it is not submitted to normal web-server request logs. Without these variables, accounts remain inactive.

---

## 4. Authentication & Profile Endpoints

### `POST /api/auth/register`
- **Description**: Registers a new Student or Faculty account. Admin accounts cannot be registered publicly.
- **Access**: Public
- **Request Body**:
```json
{
  "name": "Harsh Vardhan",
  "email": "harsh.ce@college.edu",
  "password": "Password123",
  "role": "STUDENT",
  "department": "Computer Engineering",
  "enrollmentNo": "BE-2022-CS-104"
}
```

### `POST /api/auth/login`
- **Description**: Authenticates an active user, returns a short-lived JWT Bearer token with role metadata, and sets an HttpOnly refresh-session cookie.
- **Access**: Public
- **Request Body**: `{ "email": "student@college.edu", "password": "...", "portalRole": "STUDENT" }`
- **Portal selection**: `portalRole` is optional for API clients. When provided by the login UI, it must match the role stored for the account; it never grants or changes authorization.

### `POST /api/auth/refresh`
- **Description**: Rotates the current HttpOnly refresh session and returns a new access token. Refresh tokens are never returned in JSON.
- **Access**: Public with a valid refresh cookie
- **Failure**: Invalid, expired, revoked, or replayed refresh sessions return `401`; replay detection revokes the user's remaining refresh sessions.

### `POST /api/auth/request-password-reset`
- **Description**: Requests a one-time password reset email. The response is intentionally identical whether the email belongs to an active account or not.
- **Access**: Public; limited to 5 requests per IP per 15 minutes in the current process-local limiter.
- **Request Body**: `{ "email": "student@college.edu" }`
- **Response**: `202 Accepted` with `{ "success": true, "message": "If an active account exists for that email, a password reset link has been sent." }`
- **Security**: Reset tokens are hashed at rest, expire after one hour, and are never returned by the API.

### `POST /api/auth/reset-password`
- **Description**: Consumes a valid single-use reset token and updates the bcrypt password hash.
- **Access**: Public with a reset token; limited by the authentication limiter.
- **Request Body**: `{ "token": "<raw-token>", "password": "NewPassword123" }`
- **Response**: `200 OK` after the token is consumed and remaining reset tokens for the account are invalidated.
- **Failure**: Invalid, expired, already-used, or non-active-account tokens return a safe `400` message.

### `GET /api/auth/me`
- **Description**: Returns the authenticated user session profile.
- **Access**: Authenticated

### `POST /api/auth/logout`
- **Description**: Revokes the current refresh session, clears the refresh cookie, and lets the browser discard its in-memory access token. An already-issued access token remains valid until expiry.
- **Access**: Public/idempotent

---

## 4. Course Management & Enrollment

### `GET /api/courses`
- **Description**: Lists courses with enrollment and material metrics.
- **Access**: Authenticated

### `GET /api/courses/:id`
- **Description**: Detailed course profile with syllabus units, materials, assignments, and active quizzes.
- **Access**: Authenticated

### `POST /api/courses/:id/enroll`
- **Description**: Enrolls authenticated student into the course. Rejects faculty/admin and duplicate enrollments with 409.
- **Access**: `STUDENT`

### `DELETE /api/courses/:id/enroll`
- **Description**: Unenrolls student from the course.
- **Access**: `STUDENT`, `ADMIN`

---

## 5. Announcements & Notifications

### `GET /api/announcements`
- **Description**: Returns recent announcements visible to the authenticated user. Students receive institution announcements and announcements for their active courses; faculty receive announcements they authored; administrators receive all announcements.
- **Access**: Authenticated

### `POST /api/announcements`
- **Description**: Publishes an announcement and creates notification records for the targeted active students.
- **Access**: `FACULTY`, `ADMIN`
- **Request Body**:
```json
{
  "title": "Midterm review session",
  "body": "The review session is scheduled for Friday at 3 PM.",
  "courseId": "optional-course-id"
}
```
- Faculty must provide a course they teach. Administrators may provide a course or omit `courseId` to notify all active students.

### `GET /api/notifications`
- **Description**: Returns the authenticated user's recent notifications and unread count.
- **Access**: Authenticated

### `PATCH /api/notifications/:id/read`
- **Description**: Marks one notification as read. A user cannot mark another user's notification as read.
- **Access**: Authenticated

### `PATCH /api/notifications/read-all`
- **Description**: Marks all unread notifications for the authenticated user as read.
- **Access**: Authenticated

---

## 6. Course Materials & Document Ingestion (Phase 1 & Phase 2 RAG)

### `POST /api/courses/:courseId/materials`
- **Description**: Accepts multipart/form-data PDF upload, extracts text, generates 500-token overlapping chunks, computes 3072-dimensional vector embeddings with Gemini, and stores them in PostgreSQL `DocumentChunk` with `vector(3072)`.
- **Access**: Assigned `FACULTY`, `ADMIN`
- **Content-Type**: `multipart/form-data`
- **Form Fields**: `file` (binary PDF), `title` (string), `unit` (string)
- **Response `201 Created`**:
```json
{
  "success": true,
  "message": "Material uploaded and ingested successfully",
  "data": {
    "id": "42b2111d-874d-46e2-8f49-35d39220cbbd",
    "courseId": "1199a8c3-a23f-49a1-9502-5caabf6106d3",
    "title": "Unit 2: Raft Consensus Protocol",
    "unit": "Unit 2",
    "fileUrl": "/uploads/materials/1724281200000-Unit2_Raft.pdf",
    "processingStatus": "READY",
    "ragChunksCount": 2
  }
}
```

### `GET /api/materials/:id/chunks`
- **Description**: Paginated inspection endpoint for document chunks, token counts, and page numbers.
- **Access**: Authenticated
- **Query Parameters**: `page` (default: 1), `limit` (default: 20)

---

## 6. AI Academic Tutor & Vector RAG (Phase 2)

### `POST /api/ai/conversations`
- **Description**: Starts an AI conversation thread linked to a specific course.
- **Access**: Authenticated

### `GET /api/ai/conversations`
- **Description**: Lists all active chat sessions for the authenticated user.
- **Access**: Authenticated

### `POST /api/ai/conversations/:id/messages`
- **Description**: Submits a student query $\to$ generates a Gemini query vector $\to$ executes PostgreSQL pgvector cosine distance search (`<=>`) scoped to the conversation course $\to$ constructs a bounded grounded prompt $\to$ calls the configured completion provider (Gemini by default; Groq only when explicitly configured) $\to$ stores `AIMessage` with retrieved source references.
- **Access**: Authenticated (Owner of conversation)
- **Request Body**:
```json
{
  "content": "How does Raft elect a leader and prevent split votes?"
}
```
- The request must include a unique `Idempotency-Key` header (the same value may also be sent as `idempotencyKey` in the body). The key is scoped to the authenticated user and is bound to the conversation and message payload. Concurrent or repeated submissions cannot create duplicate provider calls. A different payload or conversation with the same key returns `409 Conflict`.
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "userMessage": {
      "id": "uuid-user-msg",
      "sender": "user",
      "content": "How does Raft elect a leader and prevent split votes?"
    },
    "assistantMessage": {
      "id": "uuid-asst-msg",
      "sender": "assistant",
      "content": "Based on Unit 2: Raft Consensus Protocol, followers transition to Candidate state when election timeouts expire...",
      "sources": [
        {
          "documentName": "Unit 2: Raft Consensus Protocol",
          "materialId": "material-uuid",
          "unit": "Unit 2",
          "page": 2,
          "chunkId": "chunk-uuid",
          "score": 0.827,
          "excerpt": "Section 2: Leader Election and Randomized Election Timeouts..."
        }
      ],
      "suggestedFollowUps": [
        "Can you provide a step-by-step example of this topic?",
        "How is this concept evaluated in university examinations?"
      ]
    }
  }
}
```

### `GET /api/ai/conversations/:id/messages/status/:key`
- **Description**: Authenticated status/result lookup for an AI message submission after a timeout or connection interruption.
- **Access**: Conversation owner with current course authorization.
- **States**: `PROCESSING`, `COMPLETED`, or `FAILED`.
- **Retry policy**: Only `FAILED` requests may be retried with the same key. An active `PROCESSING` request, including one that is old, is not reclaimed solely because of age.

---

## 7. Assignments & Submissions

### `GET /api/courses/:courseId/assignments`
- **Access**: Authenticated

### `POST /api/assignments/:id/submissions`
- **Description**: Submit student solution for an assignment.
- **Access**: `STUDENT`

### `PUT /api/submissions/:id/grade`
- **Description**: Assign score and academic feedback.
- **Access**: `FACULTY`, `ADMIN`

---

## 8. Quizzes & Adaptive Diagnostics

### `GET /api/courses/:courseId/quizzes`
- **Access**: Authenticated

### `POST /api/quizzes/:id/attempts`
- **Description**: Evaluates student attempt, records score, and auto-tags `weakTopicsIdentified`.
- **Access**: `STUDENT`

### `GET /api/students/:id/weak-topics`
- **Description**: Dynamically calculates aggregated student weaknesses with `CRITICAL` or `MODERATE` ratings.
- **Access**: `STUDENT`, `FACULTY`, `ADMIN`

### `GET /api/students/:id/recommendations`
- **Description**: Retrieves personalized targeted study materials.
- **Access**: `STUDENT`, `FACULTY`, `ADMIN`

---

## 9. Faculty Analytics & Admin Console

### `GET /api/analytics/at-risk`
- **Description**: Returns all at-risk students across courses with risk scores and suggested interventions.
- **Access**: `FACULTY`, `ADMIN`

### `GET /api/users`
- **Description**: University user roster management.
- **Access**: `ADMIN`
