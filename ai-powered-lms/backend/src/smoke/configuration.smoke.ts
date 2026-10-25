import assert from "node:assert/strict";
import test from "node:test";
import { assertDemoSeedAllowed, productionConfigurationErrors } from "../config/production-config.js";

const productionEnv = {
  NODE_ENV: "production",
  FRONTEND_URL: "https://lms.example.edu",
  DATABASE_URL: "postgresql://user:password@db.example.edu:5432/aura",
  JWT_SECRET: "a".repeat(32) + "!strong-production-secret",
  ACCESS_TOKEN_EXPIRES_IN: "15m",
  RESEND_API_KEY: "re_test_key",
  VERIFICATION_EMAIL_FROM: "AURA LMS <no-reply@example.edu>",
  GEMINI_API_KEY: "gemini-production-key",
  DEFAULT_LLM_PROVIDER: "gemini",
  S3_ENABLED: "true",
  S3_BUCKET_NAME: "aura-materials",
  S3_REGION: "us-east-1",
} as NodeJS.ProcessEnv;

test("production configuration accepts the complete secure contract", () => {
  assert.deepEqual(productionConfigurationErrors(productionEnv), []);
});

test("production configuration rejects local storage, weak auth, and missing providers", () => {
  const errors = productionConfigurationErrors({ NODE_ENV: "production", FRONTEND_URL: "http://localhost:3000" });
  assert.equal(errors.some((error) => error.includes("FRONTEND_URL") && error.includes("HTTPS")), true);
  assert.equal(errors.some((error) => error.includes("JWT_SECRET")), true);
  assert.equal(errors.some((error) => error.includes("ACCESS_TOKEN_EXPIRES_IN")), true);
  assert.equal(errors.some((error) => error.includes("S3_ENABLED")), true);
  assert.equal(errors.some((error) => error.includes("GEMINI_API_KEY")), true);
});

test("demo seed is explicitly blocked in production", () => {
  assert.throws(() => assertDemoSeedAllowed({ NODE_ENV: "production" }), /demo seed is disabled/i);
  assert.doesNotThrow(() => assertDemoSeedAllowed({ NODE_ENV: "development" }));
});
