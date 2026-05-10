import type { GithubIssueCommentInput } from "./types.js";

export type GithubCommentResult =
  | { ok: true; html_url: string; id: number }
  | { ok: false; status: number; message: string };

/** POST /repos/{owner}/{repo}/issues/{n}/comments — fine-grained PAT needs `issues: write`. */
export async function postGithubIssueComment(
  pat: string,
  input: GithubIssueCommentInput,
): Promise<GithubCommentResult> {
  const url = `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issue_number}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: input.body }),
  });

  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, message: text.slice(0, 500) };
  }

  const json = JSON.parse(text) as { html_url?: string; id?: number };
  return {
    ok: true,
    html_url: json.html_url ?? url,
    id: typeof json.id === "number" ? json.id : 0,
  };
}
