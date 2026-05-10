import { and, asc, eq } from "drizzle-orm";
import type { BeaconDb } from "@beacon/db";
import { decryptAes256Gcm, parseMasterKeyFromEnv } from "@beacon/db";
import { createChatModel, postGithubIssueComment } from "@beacon/ai";
import { actionRuns, actionSteps, incidents, integrationsGithub } from "@beacon/db/schema";
import { z } from "zod";

const githubCommentInput = z.object({
  owner: z.string().min(1).max(200),
  repo: z.string().min(1).max(200),
  issue_number: z.number().int().min(1),
  body: z.string().min(1).max(8000),
});

export async function createActionRunForIncident(
  db: BeaconDb,
  params: {
    orgId: string;
    incidentId: string;
    createdByUserId: string;
  },
): Promise<{ ok: true; runId: string } | { ok: false; code: "incident_not_found" }> {
  const [inc] = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.id, params.incidentId), eq(incidents.orgId, params.orgId)))
    .limit(1);

  if (!inc) {
    return { ok: false, code: "incident_not_found" };
  }

  const [integration] = await db
    .select({ defaultRepo: integrationsGithub.defaultRepo })
    .from(integrationsGithub)
    .where(eq(integrationsGithub.orgId, params.orgId))
    .limit(1);

  const model = createChatModel();
  const modelName = process.env.OPENAI_API_KEY?.trim() ? (process.env.OPENAI_MODEL ?? "gpt-4o-mini") : "mock";
  const promptVersion = "v1";

  const [run] = await db
    .insert(actionRuns)
    .values({
      orgId: params.orgId,
      incidentId: params.incidentId,
      status: "draft_plan",
      createdByUserId: params.createdByUserId,
      modelName,
      promptVersion,
    })
    .returning({ id: actionRuns.id });

  if (!run) {
    throw new Error("failed to insert action run");
  }

  let stepIndex = 0;
  let needsApproval = false;

  try {
    for await (const ev of model.runToolLoop({
      incidentId: params.incidentId,
      orgId: params.orgId,
      defaultRepo: integration?.defaultRepo,
    })) {
      if (ev.type === "tool_call_proposed" && ev.toolName === "github.issue_comment") {
        const parsed = githubCommentInput.safeParse(ev.toolInput);
        if (!parsed.success) {
          await db
            .update(actionRuns)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(actionRuns.id, run.id));
          throw new Error("invalid tool proposal from model");
        }

        await db.insert(actionSteps).values({
          runId: run.id,
          index: stepIndex,
          kind: "tool_call",
          toolName: "github.issue_comment",
          toolInput: parsed.data,
          approvalStatus: "pending",
          stepStatus: "pending",
        });
        needsApproval = true;
        stepIndex += 1;
      }
    }
  } catch (e) {
    await db
      .update(actionRuns)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(actionRuns.id, run.id));
    throw e;
  }

  await db
    .update(actionRuns)
    .set({
      status: needsApproval ? "awaiting_approval" : "completed",
      updatedAt: new Date(),
    })
    .where(eq(actionRuns.id, run.id));

  return { ok: true, runId: run.id };
}

export async function getActionRunWithSteps(
  db: BeaconDb,
  params: { orgId: string; incidentId: string; runId: string },
) {
  const [run] = await db
    .select()
    .from(actionRuns)
    .where(
      and(
        eq(actionRuns.id, params.runId),
        eq(actionRuns.orgId, params.orgId),
        eq(actionRuns.incidentId, params.incidentId),
      ),
    )
    .limit(1);

  if (!run) return null;

  const steps = await db
    .select()
    .from(actionSteps)
    .where(eq(actionSteps.runId, run.id))
    .orderBy(asc(actionSteps.index));

  return { run, steps };
}

export async function approveAndExecuteGithubComment(
  db: BeaconDb,
  params: { orgId: string; incidentId: string; runId: string },
): Promise<
  | { ok: true; result: { html_url: string; id: number } }
  | { ok: false; code: "not_found" | "nothing_to_approve" | "github_not_configured" | "execute_failed"; message?: string }
> {
  const detail = await getActionRunWithSteps(db, params);
  if (!detail) {
    return { ok: false, code: "not_found" };
  }

  const pending = detail.steps.find((s) => s.approvalStatus === "pending" && s.stepStatus === "pending");
  if (!pending || pending.toolName !== "github.issue_comment") {
    return { ok: false, code: "nothing_to_approve" };
  }

  const [ig] = await db
    .select()
    .from(integrationsGithub)
    .where(eq(integrationsGithub.orgId, params.orgId))
    .limit(1);

  if (!ig) {
    return { ok: false, code: "github_not_configured", message: "PUT /v1/orgs/.../integrations/github first" };
  }

  let master: Buffer;
  try {
    master = parseMasterKeyFromEnv(process.env.APP_MASTER_KEY);
  } catch {
    return { ok: false, code: "execute_failed", message: "APP_MASTER_KEY missing" };
  }

  let pat: string;
  try {
    pat = decryptAes256Gcm(ig.patCipher, master);
  } catch {
    return { ok: false, code: "execute_failed", message: "Could not decrypt GitHub PAT" };
  }

  const input = githubCommentInput.safeParse(pending.toolInput);
  if (!input.success) {
    return { ok: false, code: "execute_failed", message: "Invalid stored tool input" };
  }

  const exec = await postGithubIssueComment(pat, input.data);
  if (!exec.ok) {
    await db
      .update(actionSteps)
      .set({ stepStatus: "failed", toolOutput: { error: exec.message, status: exec.status } })
      .where(eq(actionSteps.id, pending.id));
    await db
      .update(actionRuns)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(actionRuns.id, params.runId));
    return { ok: false, code: "execute_failed", message: exec.message };
  }

  await db
    .update(actionSteps)
    .set({
      approvalStatus: "approved",
      stepStatus: "succeeded",
      toolOutput: { html_url: exec.html_url, id: exec.id },
    })
    .where(eq(actionSteps.id, pending.id));

  await db
    .update(actionRuns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(actionRuns.id, params.runId));

  return { ok: true, result: { html_url: exec.html_url, id: exec.id } };
}
