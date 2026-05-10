import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** `owner` | `member` */
export const membershipRoleEnum = pgEnum("membership_role", ["owner", "member"]);

/** `open` | `acknowledged` | `resolved` */
export const incidentStatusEnum = pgEnum("incident_status", ["open", "acknowledged", "resolved"]);

/** `SEV1` … `SEV4` */
export const severityEnum = pgEnum("severity", ["SEV1", "SEV2", "SEV3", "SEV4"]);

/** `pending` | `sent` | `failed` */
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

/** Action run lifecycle (CP09) */
export const actionRunStatusEnum = pgEnum("action_run_status", [
  "draft_plan",
  "awaiting_approval",
  "executing",
  "completed",
  "failed",
  "cancelled",
]);

export const actionStepKindEnum = pgEnum("action_step_kind", ["llm", "tool_call"]);

export const actionApprovalEnum = pgEnum("action_approval_status", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);

export const actionStepStatusEnum = pgEnum("action_step_status", ["pending", "running", "succeeded", "failed"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  clerkUserId: text("clerk_user_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byUser: index("sessions_user_id").on(t.userId),
  }),
);

export const orgs = pgTable(
  "orgs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** AES-256-GCM (iv + tag + ciphertext) as base64 — see `docs/BEACON_SPEC.md` */
    webhookSecretCipher: text("webhook_secret_cipher").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugCheck: check("orgs_slug_check", sql`${t.slug} ~ '^[a-z0-9-]+$'`),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
  }),
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    severity: severityEnum("severity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgNameLowerUnique: uniqueIndex("services_org_name_lower").on(t.orgId, sql`lower(${t.name})`),
  }),
);

export const escalationPolicies = pgTable("escalation_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const escalationSteps = pgTable(
  "escalation_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => escalationPolicies.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    waitSeconds: integer("wait_seconds").notNull(),
    notifyUserId: uuid("notify_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => ({
    policyStepUnique: uniqueIndex("escalation_steps_policy_step_idx").on(t.policyId, t.stepIndex),
  }),
);

export const servicePolicyBindings = pgTable("service_policy_bindings", {
  serviceId: uuid("service_id")
    .primaryKey()
    .references(() => services.id, { onDelete: "cascade" }),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => escalationPolicies.id, { onDelete: "restrict" }),
});

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    status: incidentStatusEnum("status").notNull().default("open"),
    severity: severityEnum("severity").notNull(),
    title: text("title").notNull(),
    dedupeKey: text("dedupe_key"),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    nextActionAt: timestamp("next_action_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    ackedAt: timestamp("acked_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    openedByUserId: uuid("opened_by_user_id").references(() => users.id, { onDelete: "set null" }),
    externalRef: text("external_ref"),
  },
  (t) => ({
    tickDueIdx: index("incidents_tick_due").on(t.nextActionAt).where(
      sql`${t.resolvedAt} IS NULL AND ${t.ackedAt} IS NULL AND ${t.nextActionAt} IS NOT NULL`,
    ),
    dedupeActivePartial: uniqueIndex("incidents_dedupe_active").on(t.orgId, t.dedupeKey).where(
      sql`${t.dedupeKey} IS NOT NULL AND ${t.status} IN ('open','acknowledged')`,
    ),
  }),
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byIncidentTime: index("incident_events_incident_time").on(t.incidentId, t.createdAt),
  }),
);

export const notificationAttempts = pgTable(
  "notification_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    toEmail: text("to_email").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(1),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    oneRowPerStep: uniqueIndex("notification_attempts_incident_step").on(t.incidentId, t.stepIndex),
  }),
);

/** CP09 — GitHub PAT + default repo */
export const integrationsGithub = pgTable("integrations_github", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => orgs.id, { onDelete: "cascade" }),
  patCipher: text("pat_cipher").notNull(),
  defaultRepo: text("default_repo").notNull(),
});

/** CP09 */
export const actionRuns = pgTable("action_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  status: actionRunStatusEnum("status").notNull().default("draft_plan"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  modelName: text("model_name").notNull(),
  promptVersion: text("prompt_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const actionSteps = pgTable(
  "action_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => actionRuns.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    kind: actionStepKindEnum("kind").notNull(),
    toolName: text("tool_name"),
    toolInput: jsonb("tool_input"),
    toolOutput: jsonb("tool_output"),
    approvalStatus: actionApprovalEnum("approval_status").notNull().default("not_required"),
    stepStatus: actionStepStatusEnum("step_status").notNull().default("pending"),
  },
  (t) => ({
    runIdx: uniqueIndex("action_steps_run_index").on(t.runId, t.index),
  }),
);

export const statusPageSettings = pgTable("status_page_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => orgs.id, { onDelete: "cascade" }),
  showResolvedHours: integer("show_resolved_hours").notNull().default(72),
  bannerMd: text("banner_md"),
});
