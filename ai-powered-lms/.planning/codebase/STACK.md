# Technology Stack

This document details the complete technology stack, runtimes, dependencies, and environment configurations for **AURA LMS** (AI-powered University Resource & Academic Learning System).

---

## 1. Core Runtime & Languages

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js (ES Modules) | v20+ | Server-side execution runtime with native ESM (`"type": "module"`) |
| **Backend Language** | TypeScript | `^5.9.3` | Strongly typed backend application development |
| **Frontend Framework** | Next.js (App Router) | `16.3.0` | React server/client component framework with Turbopack |
| **Frontend Core** | React / React DOM | `19.2.8` | Component-based UI library supporting React 19 features |
| **Frontend Language** | TypeScript | `^5.0.0` | Strongly typed UI development with strict JSX typing |

---

## 2. Backend Infrastructure & Libraries

### Web Framework & Routing
- **Express.js (`5.2.1`)**: Core HTTP web application framework handling REST API routing, JSON body parsing, and middleware chains.
- **CORS (`2.8.6`)**: Cross-Origin Resource Sharing middleware enabling secure cross-origin requests between Next.js (port 3000) and Express (port 5000).
- **Dotenv (`17.4.2`)**: Loads environment variables from `.env` on backend boot.

### Database & ORM
- **PostgreSQL (`18.6`)**: Primary relational database management system.
- **pgvector (`0.8.6`)**: PostgreSQL extension for storing and indexing high-dimensional vector embeddings with cosine distance (`<=>`).
- **Prisma ORM (`7.9.1`)**: Modern database toolkit with typed schema definition, database migrations, and client generation.
- **`@prisma/adapter-pg` (`7.9.1`) & `pg` (`8.23.0`)**: PostgreSQL driver adapter utilizing connection pooling for high concurrency.
- **Prisma Client Location**: Output generated into `backend/src/generated/prisma`.

### Authentication & Cryptography
- **jsonwebtoken (`9.0.3`)**: Issues and verifies HS256 JWT tokens containing `userId`, `role`, `email`, and `department`.
- **bcrypt (`6.0.0`)**: Salt generation and one-way password hashing (10 rounds) for user credentials.

### File Ingestion & Parsing
- **multer (`2.2.0`)**: Multipart form-data handling for academic PDF uploads (`upload.middleware.ts`).
- **pdf-parse (`2.4.5`)**: Server-side binary PDF text extraction with page boundary mapping and text normalization.

### AI & LLM Engine
- **`@google/genai` (`^2.18.0`)**: Official Google GenAI SDK for Gemini API access.
  - **Generation Model**: `gemini-3.7-flash` (with configurable latency thinking budgets: 0 for standard academic chat, 1024 for complex proofs; fallback models: `gemini-3.5-flash`, `gemini-flash-latest`, `gemini-3.5-flash-lite`).
  - **Embedding Model**: `gemini-embedding-001` (3072 dimensions) with exponential backoff and retry handlers.

---

## 3. Frontend Architecture & Libraries

### Styling & Design System
- **Tailwind CSS (`v4.0.0` with `@tailwindcss/postcss`)**: Modern utility-first CSS framework configured via PostCSS.
- **Design System**: Stitch MCP Academic Design System tokens (`projects/13433975273178369994`) defined in `globals.css`:
  - Deep Navy primary (`#00288e`), Emerald success (`#16a34a`), Amber warning (`#d97706`), Rose danger (`#dc2626`).
  - Custom UI utilities: `.card-interactive`, `.btn-press`, `.academic-table`.
  - Accessible animations with `@media (prefers-reduced-motion: reduce)`.

### Client-Side PDF Rendering
- **PDF.js (Dynamic Import)**: Dynamic canvas-based client rendering for protected binary PDF streaming with page tracking and continuous reading persistence.

### State Management & Communication
- **React Context (`AuthContext.tsx`)**: Client-side authentication state, session storage in `localStorage`, role resolution, and login/logout state distribution.
- **Fetch API Client (`api.ts`)**: Standardized `apiRequest<T>()` client injecting JWT `Authorization: Bearer <token>` headers and handling API error normalization.

---

## 4. Build Tools & Development Scripts

### Backend (`backend/package.json`)
```bash
npm run dev                 # Compiles TypeScript and runs dist/server.js
npm run build               # Compiles TypeScript to dist/ (tsc)
npm run start               # Runs production server (node dist/server.js)
npm run test:db             # Verifies PostgreSQL connection and model counts
npm run seed                # Provisions complete demo database and seed users
npm run embeddings:backfill # Generates 3072-dim embeddings for all existing chunks
npm run rag:test            # Quick RAG semantic search test against PostgreSQL
npm run test:rag            # Full end-to-end vector RAG test suite
```

### Frontend (`frontend/package.json`)
```bash
npm run dev                 # Starts Next.js development server (port 3000)
npm run build               # Builds Next.js production bundle (next build)
npm run start               # Starts Next.js production server
npm run lint                # Runs ESLint checks
```
