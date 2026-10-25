export function productionConfigurationErrors(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];

  const errors: string[] = [];
  const frontendUrl = required(env, "FRONTEND_URL", errors);
  if (frontendUrl) {
    try {
      const parsed = new URL(frontendUrl);
      if (parsed.protocol !== "https:") {
        errors.push("FRONTEND_URL must use HTTPS in production");
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
        errors.push("FRONTEND_URL must be a single origin without a path, query, hash, or credentials");
      }
    } catch {
      errors.push("FRONTEND_URL must be a valid URL");
    }
  }

  const databaseUrl = required(env, "DATABASE_URL", errors);
  if (databaseUrl && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    errors.push("DATABASE_URL must be a PostgreSQL connection string");
  }

  const jwtSecret = required(env, "JWT_SECRET", errors);
  if (jwtSecret && (jwtSecret.length < 32 || isWeakSecret(jwtSecret))) {
    errors.push("JWT_SECRET must be a non-placeholder secret of at least 32 characters");
  }

  const accessTokenTtl = required(env, "ACCESS_TOKEN_EXPIRES_IN", errors);
  if (accessTokenTtl && !isShortAccessTokenTtl(accessTokenTtl)) {
    errors.push("ACCESS_TOKEN_EXPIRES_IN must be a positive duration no longer than 1 hour");
  }

  required(env, "RESEND_API_KEY", errors);
  required(env, "VERIFICATION_EMAIL_FROM", errors);

  const geminiKey = env.GEMINI_API_KEY?.trim();
  const provider = (env.DEFAULT_LLM_PROVIDER || "gemini").trim().toLowerCase();
  if (provider !== "gemini" && provider !== "groq") {
    errors.push("DEFAULT_LLM_PROVIDER must be gemini or groq");
  }
  if (provider === "groq") required(env, "GROQ_API_KEY", errors);
  if (!geminiKey) errors.push("GEMINI_API_KEY is required because embeddings and AI tutor features are enabled");

  if (env.S3_ENABLED !== "true") {
    errors.push("S3_ENABLED must be true in production; local disk storage is not allowed");
  }
  required(env, "S3_BUCKET_NAME", errors);
  required(env, "S3_REGION", errors);
  if ((env.AWS_ACCESS_KEY_ID && !env.AWS_SECRET_ACCESS_KEY) || (!env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY)) {
    errors.push("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be provided together when using explicit S3 credentials");
  }

  return unique(errors);
}

export function assertDemoSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production") {
    throw new Error("The demo seed is disabled when NODE_ENV=production");
  }
}

function required(env: NodeJS.ProcessEnv, name: string, errors: string[]): string | undefined {
  const value = env[name]?.trim();
  if (!value) errors.push(`${name} is required in production`);
  return value || undefined;
}

function isWeakSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();
  return ["replace-with", "change-me", "your-secret", "password", "test-secret", "jwt-secret"].some((marker) =>
    normalized.includes(marker)
  ) || /^(.)\1+$/.test(secret) || new Set(secret).size < 12;
}

function isShortAccessTokenTtl(value: string): boolean {
  const match = /^(\d+)\s*(s|m|h)$/i.exec(value.trim());
  if (!match) return false;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const seconds = unit === "h" ? amount * 3600 : unit === "m" ? amount * 60 : amount;
  return seconds > 0 && seconds <= 3600;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
