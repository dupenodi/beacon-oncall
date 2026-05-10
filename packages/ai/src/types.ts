/** Proposed GitHub Issues API comment (REST: POST /repos/{owner}/{repo}/issues/{issue_number}/comments). */
export type GithubIssueCommentInput = {
  owner: string;
  repo: string;
  issue_number: number;
  body: string;
};

export type ToolEvent =
  | { type: "log"; message: string }
  | {
      type: "tool_call_proposed";
      toolName: "github.issue_comment";
      toolInput: GithubIssueCommentInput;
      stepIndex: number;
    };

export type ChatModelInput = {
  incidentId: string;
  orgId: string;
  /** `owner/repo` from org GitHub integration when configured. */
  defaultRepo?: string;
};

export interface ChatModel {
  runToolLoop(input: ChatModelInput): AsyncIterable<ToolEvent>;
}
