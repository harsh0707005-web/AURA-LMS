import { Request, Response, NextFunction, RequestHandler } from "express";

type Bucket = { count: number; resetAt: number };

/** A small dependency-free fixed-window limiter for endpoint-specific abuse control. */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let lastCleanup = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (now - lastCleanup > options.windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      lastCleanup = now;
    }

    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", options.max);
    res.setHeader("RateLimit-Remaining", Math.max(0, options.max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        success: false,
        message: options.message || "Too many requests. Please try again later.",
      });
      return;
    }
    next();
  };
}

/** Security headers that do not require a third-party middleware dependency. */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}
