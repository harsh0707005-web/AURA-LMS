import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebsiteContext } from "../services/ai/website-context.service.js";

test("website greetings are answered locally with role-appropriate suggestions", async () => {
  const result = await resolveWebsiteContext("Hello tutor", "student-1", "STUDENT");

  assert.ok(result);
  assert.equal(result.intent, "GREETING");
  assert.match(result.answer, /enrolled courses|weak topics/i);
  assert.equal(result.suggestedFollowUps.length, 12);
});

test("website help is answered locally without provider generation", async () => {
  const result = await resolveWebsiteContext("What can you do?", "faculty-1", "FACULTY");

  assert.ok(result);
  assert.equal(result.intent, "WEBSITE_HELP");
  assert.match(result.answer, /faculty workspace|authorized/i);
  assert.equal(result.suggestedFollowUps.length, 12);
  assert.match(result.suggestedFollowUps[0], /students|courses/i);
});

test("course-grounded questions remain outside website-intent handling", async () => {
  const result = await resolveWebsiteContext("Explain randomized election timeouts in Raft.", "student-1", "STUDENT");

  assert.equal(result, null);
});

test("website matching does not hijack ordinary academic wording", async () => {
  const results = await Promise.all([
    resolveWebsiteContext("How can I improve Raft leader election?", "student-1", "STUDENT"),
    resolveWebsiteContext("Explain assignment scheduling in operating systems.", "student-1", "STUDENT"),
    resolveWebsiteContext("How should I optimize database performance?", "student-1", "STUDENT"),
  ]);

  assert.deepEqual(results, [null, null, null]);
});
