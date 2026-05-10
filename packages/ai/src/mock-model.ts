import { getForcedGithubIssueNumber } from "./github-issue-number-env.js";
import type { ChatModel, ChatModelInput, ToolEvent } from "./types.js";

/** Deterministic proposal for CI / dev without `OPENAI_API_KEY`. */
export class MockChatModel implements ChatModel {
  async *runToolLoop(input: ChatModelInput): AsyncIterable<ToolEvent> {
    yield { type: "log", message: "MockChatModel: drafting github.issue_comment proposal" };

    const raw = input.defaultRepo ?? "octocat/Hello-World";
    const parts = raw.split("/").filter(Boolean);
    const owner = parts[0] ?? "octocat";
    const repo = parts[1] ?? "Hello-World";

    const issue_number = getForcedGithubIssueNumber() ?? 1;

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
