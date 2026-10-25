import "dotenv/config";
import { emailConfigurationErrors } from "../services/email-delivery.service.js";

const errors = emailConfigurationErrors();
if (errors.length > 0) {
  console.error("Email delivery configuration is incomplete:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Email delivery configuration is valid for the current environment.");
  console.log("This check does not send an email. Use a synthetic test account to verify real delivery.");
}
