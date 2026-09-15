import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// Fail-fast JWT_SECRET check on server startup
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  console.error("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined!");
  process.exit(1);
}

import prisma from "./lib/prisma.js";
import { errorHandler } from "./middleware/error.middleware.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
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

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// CORS Configuration
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Health Check Endpoints
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AURA LMS backend service is operational",
    version: "1.0.0",
    academicProject: "AI-Powered LMS with LLMs and Learning Analytics",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    const courseCount = await prisma.course.count();
    res.status(200).json({
      success: true,
      message: "PostgreSQL database connection is healthy",
      database: "ai_lms",
      stats: {
        totalUsers: userCount,
        totalCourses: courseCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database connection failed";
    res.status(503).json({
      success: false,
      message: "Database health check failed",
      error: message,
    });
  }
});

// Mount API Modules
app.use("/api/auth", authRoutes);
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

// Centralized Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log("==========================================");
  console.log(`AURA LMS Backend Running on http://localhost:${PORT}`);
  console.log(`Allowed Frontend Origin: ${FRONTEND_URL}`);
  console.log("==========================================");
});

export default app;