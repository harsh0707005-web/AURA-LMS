export type EmailDeliveryStatus = "SENT" | "NOT_CONFIGURED" | "FAILED";

type EmailKind = "verification" | "password-reset" | "diagnostic";

interface SendEmailInput {
  kind: EmailKind;
  path: "/verify-email" | "/reset-password";
  token?: string;
  to: string;
  subject: string;
  text: string;
}

export function emailConfigurationErrors(env: NodeJS.ProcessEnv = process.env): string[] {
  const errors: string[] = [];
  if (!env.RESEND_API_KEY?.trim()) errors.push("RESEND_API_KEY is missing");
  if (!env.VERIFICATION_EMAIL_FROM?.trim()) errors.push("VERIFICATION_EMAIL_FROM is missing");

  const frontendUrl = env.FRONTEND_URL?.trim();
  if (!frontendUrl) {
    errors.push("FRONTEND_URL is missing");
  } else {
    try {
      const parsed = new URL(frontendUrl);
      const localDevelopmentUrl = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !(env.NODE_ENV !== "production" && localDevelopmentUrl)) {
        errors.push("FRONTEND_URL must use HTTPS outside local development");
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
        errors.push("FRONTEND_URL must be an origin without a path, query, hash, or credentials");
      }
    } catch {
      errors.push("FRONTEND_URL must be a valid URL");
    }
  }

  return errors;
}

export async function sendResendEmail(input: SendEmailInput): Promise<EmailDeliveryStatus> {
  if (emailConfigurationErrors().length > 0) return "NOT_CONFIGURED";

  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.VERIFICATION_EMAIL_FROM!.trim();
  const frontendUrl = process.env.FRONTEND_URL!.trim();

  try {
    const url = new URL(input.path, frontendUrl);
    if (input.token) url.hash = new URLSearchParams({ token: input.token }).toString();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text.replace("{{LINK}}", url.toString()) }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`[EMAIL_DELIVERY] kind=${input.kind} status=FAILED provider_status=${response.status}`);
      return "FAILED";
    }

    console.info(`[EMAIL_DELIVERY] kind=${input.kind} status=SENT provider=resend`);
    return "SENT";
  } catch (error: unknown) {
    const category = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
    console.warn(`[EMAIL_DELIVERY] kind=${input.kind} status=FAILED category=${category}`);
    return "FAILED";
  }
}
