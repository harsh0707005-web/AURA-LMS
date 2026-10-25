import test from "node:test";
import assert from "node:assert/strict";
import { emailConfigurationErrors } from "../services/email-delivery.service.js";
import { sendVerificationEmail } from "../services/verification-email.service.js";
import { sendPasswordResetEmail } from "../services/password-reset-email.service.js";

test("email configuration check rejects missing provider values", () => {
  const errors = emailConfigurationErrors({ NODE_ENV: "production", FRONTEND_URL: "https://lms.example.edu" });
  assert.deepEqual(errors, ["RESEND_API_KEY is missing", "VERIFICATION_EMAIL_FROM is missing"]);
});

test("email configuration check accepts a secure production origin", () => {
  const errors = emailConfigurationErrors({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test_key",
    VERIFICATION_EMAIL_FROM: "AURA LMS <no-reply@example.edu>",
    FRONTEND_URL: "https://lms.example.edu",
  });
  assert.deepEqual(errors, []);
});

test("email configuration check rejects a frontend path in production", () => {
  const errors = emailConfigurationErrors({
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test_key",
    VERIFICATION_EMAIL_FROM: "AURA LMS <no-reply@example.edu>",
    FRONTEND_URL: "https://lms.example.edu/app",
  });
  assert.deepEqual(errors, ["FRONTEND_URL must be an origin without a path, query, hash, or credentials"]);
});

test("verification and reset mail keep tokens in fragments and secrets out of diagnostics", async t => {
  const values = { NODE_ENV: "test", RESEND_API_KEY: "synthetic-provider-key", VERIFICATION_EMAIL_FROM: "AURA <sender@example.invalid>", FRONTEND_URL: "https://lms.example.invalid" };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const logs: string[] = [];
  t.mock.method(console, "info", (message: string) => logs.push(message));
  t.mock.method(console, "warn", (message: string) => logs.push(message));
  let mode: "success" | "provider-error" | "timeout" = "success";
  const bodies: { text: string; to: string[] }[] = [];
  t.mock.method(globalThis, "fetch", async (_input: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    if (mode === "timeout") throw new DOMException("sensitive provider body", "TimeoutError");
    return new Response(mode === "success" ? "{}" : "sensitive provider body", { status: mode === "success" ? 200 : 403 });
  });
  const token = "a".repeat(64);
  const recipient = "synthetic-student@example.invalid";
  assert.equal(await sendVerificationEmail(recipient, token), "SENT");
  assert.equal(await sendPasswordResetEmail(recipient, token), "SENT");
  for (const [i, route] of ["/verify-email", "/reset-password"].entries()) {
    const link = new URL(bodies[i].text.match(/https:\/\/\S+/)![0]);
    assert.equal(link.pathname, route);
    assert.equal(link.search, "");
    assert.equal(new URLSearchParams(link.hash.slice(1)).get("token"), token);
  }
  mode = "provider-error";
  assert.equal(await sendPasswordResetEmail(recipient, token), "FAILED");
  mode = "timeout";
  assert.equal(await sendVerificationEmail(recipient, token), "FAILED");
  process.env.RESEND_API_KEY = "";
  assert.equal(await sendVerificationEmail(recipient, token), "NOT_CONFIGURED");
  assert.equal(bodies.length, 4);
  for (const secret of [token, recipient, values.RESEND_API_KEY, "sensitive provider body"]) assert.equal(logs.join(" ").includes(secret), false);
});
