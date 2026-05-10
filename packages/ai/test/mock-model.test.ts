import { describe, expect, it } from "vitest";
import { MockChatModel } from "../src/mock-model.js";

describe("MockChatModel", () => {
  it("yields one github.issue_comment proposal", async () => {
    const m = new MockChatModel();
    const events: unknown[] = [];
    for await (const e of m.runToolLoop({
      incidentId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      defaultRepo: "acme/demo-repo",
    })) {
      events.push(e);
    }
    expect(events.length).toBeGreaterThanOrEqual(2);
    const proposed = events.find((x) => typeof x === "object" && x && (x as { type?: string }).type === "tool_call_proposed");
    expect(proposed).toMatchObject({
      type: "tool_call_proposed",
      toolName: "github.issue_comment",
    });
    const p = proposed as { toolInput: { owner: string; repo: string } };
    expect(p.toolInput.owner).toBe("acme");
    expect(p.toolInput.repo).toBe("demo-repo");
    expect((p.toolInput as { issue_number?: number }).issue_number).toBe(1);
  });

  it("uses BEACON_MOCK_GITHUB_ISSUE_NUMBER when set", async () => {
    const prev = process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
    process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = "7";
    const m = new MockChatModel();
    const events: unknown[] = [];
    for await (const e of m.runToolLoop({
      incidentId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      defaultRepo: "acme/demo-repo",
    })) {
      events.push(e);
    }
    const proposed = events.find(
      (x) => typeof x === "object" && x && (x as { type?: string }).type === "tool_call_proposed",
    ) as { toolInput: { issue_number: number } };
    expect(proposed.toolInput.issue_number).toBe(7);
    if (prev === undefined) delete process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
    else process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = prev;
  });

  it("prefers BEACON_GITHUB_ISSUE_NUMBER over BEACON_MOCK_GITHUB_ISSUE_NUMBER", async () => {
    const prevG = process.env.BEACON_GITHUB_ISSUE_NUMBER;
    const prevM = process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
    process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = "7";
    process.env.BEACON_GITHUB_ISSUE_NUMBER = "11";
    const m = new MockChatModel();
    const events: unknown[] = [];
    for await (const e of m.runToolLoop({
      incidentId: "00000000-0000-4000-8000-000000000002",
      orgId: "00000000-0000-4000-8000-000000000001",
      defaultRepo: "acme/demo-repo",
    })) {
      events.push(e);
    }
    const proposed = events.find(
      (x) => typeof x === "object" && x && (x as { type?: string }).type === "tool_call_proposed",
    ) as { toolInput: { issue_number: number } };
    expect(proposed.toolInput.issue_number).toBe(11);
    if (prevG === undefined) delete process.env.BEACON_GITHUB_ISSUE_NUMBER;
    else process.env.BEACON_GITHUB_ISSUE_NUMBER = prevG;
    if (prevM === undefined) delete process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER;
    else process.env.BEACON_MOCK_GITHUB_ISSUE_NUMBER = prevM;
  });
});
