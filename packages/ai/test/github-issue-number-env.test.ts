import { afterEach, describe, expect, it } from "vitest";
import { applyForcedGithubIssueNumber, getForcedGithubIssueNumber } from "../src/github-issue-number-env.js";

describe("getForcedGithubIssueNumber", () => {
  afterEach(() => {
    delete process.env.BEACON_GITHUB_ISSUE_NUMBER;
    delete process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
  });

  it("returns undefined when unset", () => {
    expect(getForcedGithubIssueNumber()).toBeUndefined();
  });

  it("prefers BEACON_GITHUB_ISSUE_NUMBER over BEACON_MOCK_GITHUB_ISSUE_NUMBER", () => {
    process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = "7";
    process.env.BEACON_GITHUB_ISSUE_NUMBER = "3";
    expect(getForcedGithubIssueNumber()).toBe(3);
  });

  it("falls back to BEACON_MOCK_GITHUB_ISSUE_NUMBER", () => {
    process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = "42";
    expect(getForcedGithubIssueNumber()).toBe(42);
  });

  it("ignores invalid values", () => {
    process.env.BEACON_GITHUB_ISSUE_NUMBER = "0";
    process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = "2";
    expect(getForcedGithubIssueNumber()).toBe(2);
  });
});

describe("applyForcedGithubIssueNumber", () => {
  afterEach(() => {
    delete process.env.BEACON_GITHUB_ISSUE_NUMBER;
    delete process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
  });

  it("overrides issue_number when env is set", () => {
    process.env.BEACON_GITHUB_ISSUE_NUMBER = "9";
    expect(applyForcedGithubIssueNumber({ issue_number: 1, owner: "a", repo: "b", body: "c" }).issue_number).toBe(9);
  });
});
