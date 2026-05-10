import { MockChatModel } from "./mock-model.js";
import { OpenAiChatModel } from "./openai-model.js";
import type { ChatModel } from "./types.js";

export type { ChatModel, ChatModelInput, GithubIssueCommentInput, ToolEvent } from "./types.js";
export { MockChatModel } from "./mock-model.js";
export { OpenAiChatModel } from "./openai-model.js";
export { postGithubIssueComment, type GithubCommentResult } from "./github-exec.js";
export {
  applyForcedGithubIssueNumber,
  getForcedGithubIssueNumber,
} from "./github-issue-number-env.js";

/** Prefer OpenAI when `OPENAI_API_KEY` is set; otherwise `MockChatModel` (CI-safe). */
export function createChatModel(): ChatModel {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return new OpenAiChatModel();
  }
  return new MockChatModel();
}
