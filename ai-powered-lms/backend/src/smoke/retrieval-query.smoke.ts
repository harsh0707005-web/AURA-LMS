import assert from "node:assert/strict";
import test from "node:test";
import { buildTutorRetrievalQuery } from "../services/ai.service.js";

test("expands contextual follow-up retrieval with recent student topic terms", () => {
  const query = buildTutorRetrievalQuery(
    "Can you provide a step-by-step example of Unit 2?",
    [
      { sender: "user", content: "Explain how randomized election timeouts help Raft elect a leader." },
      { sender: "assistant", content: "A grounded answer about Raft leader election." },
    ]
  );

  assert.match(query, /step-by-step example of Unit 2/i);
  assert.match(query, /randomized election timeouts/i);
});

test("does not add conversation history to standalone retrieval questions", () => {
  const query = buildTutorRetrievalQuery(
    "Explain randomized election timeouts in Raft.",
    [{ sender: "user", content: "Unrelated prior question about storage." }]
  );

  assert.equal(query, "Explain randomized election timeouts in Raft.");
});
