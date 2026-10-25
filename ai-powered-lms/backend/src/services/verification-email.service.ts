import { sendResendEmail, EmailDeliveryStatus } from "./email-delivery.service.js";

/** Tokens only leave the process through a configured email provider, never logs or API responses. */
export async function sendVerificationEmail(email: string, rawToken: string): Promise<EmailDeliveryStatus> {
  return sendResendEmail({
    kind: "verification",
    path: "/verify-email",
    token: rawToken,
    to: email,
    subject: "Verify your institutional LMS account",
    text: "Verify your email to activate your student account. This link expires in 24 hours and can only be used once:\n{{LINK}}",
  });
}
