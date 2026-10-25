import { sendResendEmail, EmailDeliveryStatus } from "./email-delivery.service.js";

/** Reset tokens only leave the process through the configured email provider. */
export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<EmailDeliveryStatus> {
  return sendResendEmail({
    kind: "password-reset",
    path: "/reset-password",
    token: rawToken,
    to: email,
    subject: "Reset your AURA LMS password",
    text: "A password reset was requested for your AURA LMS account. This link expires in 1 hour and can only be used once:\n{{LINK}}\n\nIf you did not request this, you can ignore this email.",
  });
}
