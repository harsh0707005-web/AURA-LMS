# AURA LMS — Backend API Documentation

**AI-powered University Resource & Academic Learning System**  
Department of Computer Engineering • Final Year Capstone Project

Base URL: `http://localhost:5000/api`

---

## 1. Environment & RAG Configuration

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | `postgresql://...` | PostgreSQL connection string |
| `JWT_SECRET` | String | *Required* | Secret for signing HS256 auth tokens |
| `GEMINI_API_KEY` | String | *Required* | Google Gemini API key (backend only) |
| `GEMINI_EMBEDDING_MODEL` | String | `gemini-embedding-001` | 3072-dimensional vector embedding model |
| `GEMINI_GENERATION_MODEL` | String | `gemini-flash-latest` | Grounded academic completion model |
| `RAG_TOP_K` | Number | `5` | Maximum number of chunks to retrieve |
| `RAG_MIN_SIMILARITY` | Number | `0.55` | Minimum cosine similarity threshold (1 - distance) |

---

## 2. System Health Endpoints

### `GET /api/health`
- **Description**: Returns operational status of the Express server.
- **Access**: Public

### `GET /api/health/db`
- **Description**: Verifies PostgreSQL connectivity and returns user/course counts.
- **Access**: Public

---

## 3. Authentication & Profile Endpoints

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
- **Description**: Authenticates user and returns JWT Bearer token with role metadata.
- **Access**: Public

### `GET /api/auth/me`
- **Description**: Returns the authenticated user session profile.
- **Access**: Authenticated

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

## 5. Course Materials & Document Ingestion (Phase 1 & Phase 2 RAG)

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
- **Description**: Submits student query $\to$ generates Gemini query vector $\to$ executes PostgreSQL pgvector cosine distance search (`<=>`) scoped to the conversation course $\to$ constructs grounded prompt $\to$ calls Gemini completion model $\to$ stores `AIMessage` with source citations.
- **Access**: Authenticated (Owner of conversation)
- **Request Body**:
```json
{
  "content": "How does Raft elect a leader and prevent split votes?"
}
```
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
