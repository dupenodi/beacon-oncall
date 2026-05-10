import type { ChatModel, ChatModelInput, ToolEvent } from "./types.js";

/** Deterministic proposal for CI / dev without `OPENAI_API_KEY`. */
export class MockChatModel implements ChatModel {
  async *runToolLoop(input: ChatModelInput): AsyncIterable<ToolEvent> {
    yield { type: "log", message: "MockChatModel: drafting github.issue_comment proposal" };

    const raw = input.defaultRepo ?? "octocat/Hello-World";
    const parts = raw.split("/").filter(Boolean);
    const owner = parts[0] ?? "octocat";
    const repo = parts[1] ?? "Hello-World";

    const issueFromEnv = Number.parseInt(process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER ?? "1", 10);
    const issue_number = Number.isFinite(issueFromEnv) && issueFromEnv >= 1 ? issueFromEnv : 1;

    yield {
      type: "tool_call_proposed",
      toolName: "github.issue_comment",
      toolInput: {
        owner,
        repo,
        issue_number,
        body: `Beacon (mock): triage note for incident ${input.incidentId} in org ${input.orgId}.`,
      },
      stepIndex: 0,
    };
  }
}
