import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, securityHeaders } from "../middleware/security.middleware.js";
import { isValidPdfMagicBytes } from "../middleware/upload.middleware.js";

function responseMock() {
  const headers = new Map<string, string | number>();
  return {
    headers,
    setHeader(name: string, value: string | number) { headers.set(name, value); },
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    jsonBody: undefined as unknown,
    json(body: unknown) { this.jsonBody = body; return this; },
  };
}

test("rate limiter rejects requests after its configured budget", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: "198.51.100.7", socket: {} } as any;
  const first = responseMock();
  const second = responseMock();
  const third = responseMock();
  let nextCalls = 0;
  const next = () => { nextCalls += 1; };

  limiter(req, first as any, next);
  limiter(req, second as any, next);
  limiter(req, third as any, next);

  assert.equal(nextCalls, 2);
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers.get("Retry-After") !== undefined, true);
});

test("security headers are applied", () => {
  const res = responseMock();
  securityHeaders({ secure: false } as any, res as any, () => undefined);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
});

test("PDF upload validation requires the PDF magic header", () => {
  assert.equal(isValidPdfMagicBytes(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(isValidPdfMagicBytes(Buffer.from("not-a-pdf")), false);
  assert.equal(isValidPdfMagicBytes(Buffer.from("")), false);
});
