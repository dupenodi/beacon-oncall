import type { ChatModel, ChatModelInput, GithubIssueCommentInput, ToolEvent } from "./types.js";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function parseGithubToolJson(text: string): GithubIssueCommentInput {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const owner = String(obj.owner ?? "");
  const repo = String(obj.repo ?? "");
  const issue_number = Number(obj.issue_number);
  const body = String(obj.body ?? "");
  if (!owner || !repo || !Number.isFinite(issue_number) || issue_number < 1 || !body) {
    throw new Error("Invalid github.issue_comment JSON from model");
  }
  return { owner, repo, issue_number, body };
}

/** Uses Chat Completions + `response_format: json_object` when `OPENAI_API_KEY` is set. */
export class OpenAiChatModel implements ChatModel {
  async *runToolLoop(input: ChatModelInput): AsyncIterable<ToolEvent> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for OpenAiChatModel");
    }

    yield { type: "log", message: "OpenAiChatModel: requesting structured tool proposal" };

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const defaultRepo = input.defaultRepo ?? "octocat/Hello-World";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You assist on-call. Output a single JSON object with keys owner, repo, issue_number (integer), body for posting a GitHub issue comment. Keep body concise and professional.",
          },
          {
            role: "user",
            content: `Incident id: ${input.incidentId}. Org id: ${input.orgId}. Default repository is "${defaultRepo}" (use this owner/repo unless clearly wrong). Propose an issue_number in that repo (use the most likely open issue if unclear).`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${t.slice(0, 500)}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned empty content");
    }

    const toolInput = parseGithubToolJson(content);
    yield {
      type: "tool_call_proposed",
      toolName: "github.issue_comment",
      toolInput,
      stepIndex: 0,
    };
  }
}
