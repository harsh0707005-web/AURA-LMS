/** Tokens only leave the process through a configured email provider, never logs or API responses. */
export async function sendVerificationEmail(email: string, rawToken: string): Promise<"SENT" | "NOT_CONFIGURED" | "FAILED"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.VERIFICATION_EMAIL_FROM;
  const frontendUrl = process.env.FRONTEND_URL;
  if (!apiKey || !from || !frontendUrl) return "NOT_CONFIGURED";
  try {
    const url = new URL("/verify-email", frontendUrl);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return "NOT_CONFIGURED";
    // Fragment avoids sending the token in normal web-server URL/access logs.
    url.hash = new URLSearchParams({ token: rawToken }).toString();
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "Verify your institutional LMS account", text: `Verify your email to activate your student account. This link expires in 24 hours and can only be used once:\n${url.toString()}` }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? "SENT" : "FAILED";
  } catch {
    return "FAILED";
  }
}
