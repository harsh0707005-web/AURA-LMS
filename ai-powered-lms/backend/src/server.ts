import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { productionConfigurationErrors } from "./config/production-config.js";

dotenv.config();

// JWT is required in every environment; production validation below adds the
// stronger length, placeholder, and access-token lifetime requirements.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  console.error("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined!");
  process.exit(1);
}

const configurationErrors = productionConfigurationErrors();
if (configurationErrors.length > 0) {
  console.error("FATAL CONFIGURATION ERROR: production environment is incomplete or unsafe:");
  for (const error of configurationErrors) console.error(`- ${error}`);
  process.exit(1);
}

import prisma from "./lib/prisma.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { createRateLimiter, securityHeaders } from "./middleware/security.middleware.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import institutionRoutes from "./routes/institution.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import courseRoutes from "./routes/course.routes.js";
import materialRoutes from "./routes/material.routes.js";
import { assignmentRouter, submissionRouter } from "./routes/assignment.routes.js";
import { quizRouter } from "./routes/quiz.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import studentRoutes from "./routes/student.routes.js";
import facultyRoutes from "./routes/faculty.routes.js";
import userRoutes from "./routes/user.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import announcementRoutes, { notificationRoutes } from "./routes/announcement.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [FRONTEND_URL]
  : [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"];

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);
app.use(securityHeaders);

// CORS Configuration
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Client-Message-Id"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

import { storageService } from "./services/storage/storage.service.js";

// Storage Health Cache & Timeout Protection
interface CachedStorageHealth {
  provider: "local" | "s3";
  healthy: boolean;
  timestamp: number;
}

let storageHealthCache: CachedStorageHealth | null = null;
const STORAGE_HEALTH_CACHE_TTL_MS = 10000; // 10 seconds cache
const STORAGE_HEALTH_TIMEOUT_MS = 2000; // 2 seconds timeout

async function checkStorageHealthWithTimeout(): Promise<{ provider: "local" | "s3"; healthy: boolean }> {
  const providerName = storageService.getActiveProviderName() === "s3" ? "s3" : "local";

  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<{ provider: "local" | "s3"; healthy: boolean }>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[HEALTH CHECK TIMEOUT] Storage health check timed out after ${STORAGE_HEALTH_TIMEOUT_MS}ms`);
      resolve({ provider: providerName, healthy: false });
    }, STORAGE_HEALTH_TIMEOUT_MS);
  });

  const checkPromise = (async (): Promise<{ provider: "local" | "s3"; healthy: boolean }> => {
    try {
      const health = await storageService.getHealth();
      return {
        provider: providerName,
        healthy: Boolean(health?.healthy),
      };
    } catch (err: any) {
      console.error("[HEALTH CHECK ERROR] Storage health probe failed:", err);
      return { provider: providerName, healthy: false };
    }
  })();

  try {
    return await Promise.race([checkPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getCachedStorageHealth(): Promise<{ provider: "local" | "s3"; healthy: boolean }> {
  const now = Date.now();
  const currentProvider = storageService.getActiveProviderName() === "s3" ? "s3" : "local";

  if (
    storageHealthCache &&
    storageHealthCache.provider === currentProvider &&
    now - storageHealthCache.timestamp < STORAGE_HEALTH_CACHE_TTL_MS
  ) {
    return {
      provider: storageHealthCache.provider,
      healthy: storageHealthCache.healthy,
    };
  }

  const result = await checkStorageHealthWithTimeout();
  storageHealthCache = {
    provider: result.provider,
    healthy: result.healthy,
    timestamp: now,
  };

  return {
    provider: result.provider,
    healthy: result.healthy,
  };
}

// Health Check Endpoints
app.get("/api/health", async (_req, res) => {
  const storageHealth = await getCachedStorageHealth();

  res.status(200).json({
    success: true,
    message: "AURA LMS backend service is operational",
    ...(process.env.NODE_ENV === "production"
      ? { status: "ok" }
      : {
          version: "1.0.0",
          academicProject: "AI-Powered LMS with LLMs and Learning Analytics",
          storage: storageHealth,
        }),
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const courseCount = await prisma.course.count();
    res.status(200).json(
      process.env.NODE_ENV === "production"
        ? { success: true, status: "ok" }
        : {
            success: true,
            message: "PostgreSQL database connection is healthy",
            database: "ai_lms",
            stats: { totalUsers: userCount, totalCourses: courseCount },
          }
    );
  } catch (error: unknown) {
    const message = process.env.NODE_ENV === "production"
      ? "Database health check failed"
      : error instanceof Error ? error.message : "Database connection failed";
    res.status(503).json({
      success: false,
      message: "Database health check failed",
      error: message,
    });
  }
});

// Mount API Modules
app.use("/api/auth", authRoutes);
app.use("/api/admin", institutionRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/assignments", assignmentRouter);
app.use("/api/submissions", submissionRouter);
app.use("/api/quizzes", quizRouter);
app.use("/api/attempts", attemptRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/users", userRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/notifications", notificationRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Keep a module-level reference to the listener. The current Node runtime can
// garbage-collect an otherwise unreferenced listener after the callback runs,
// which makes `npm run dev` print the banner and then exit immediately.
const server = app.listen(PORT, () => {
  console.log("==========================================");
  console.log(`AURA LMS Backend Running on http://localhost:${PORT}`);
  console.log(`Allowed Frontend Origin: ${FRONTEND_URL}`);
  console.log("==========================================");
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error("AURA LMS backend failed to listen:", error.message);
  process.exitCode = 1;
});

export default app;
