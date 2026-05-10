function parsePositiveIssue(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}

/**
 * When set on the API host, overrides `issue_number` for every `github.issue_comment` proposal
 * and execution (OpenAI otherwise guesses; wrong numbers → GitHub 404).
 *
 * `BEACON_GITHUB_ISSUE_NUMBER` wins over legacy `BEACON_MOCK_GITHUB_ISSUE_NUMBER`.
 */
export function getForcedGithubIssueNumber(): number | undefined {
  return (
    parsePositiveIssue(process.env.BEACON_GITHUB_ISSUE_NUMBER) ??
    parsePositiveIssue(process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER)
  );
}

export function applyForcedGithubIssueNumber<T extends { issue_number: number }>(input: T): T {
  const forced = getForcedGithubIssueNumber();
  if (forced === undefined) return input;
  return { ...input, issue_number: forced };
}
