import { z } from "zod";

/** Normative WebhookBodySchema — `docs/BEACON_SPEC.md` */
export const WebhookBodySchema = z.object({
  schemaVersion: z.literal(1),
  dedupeKey: z.string().min(1).max(200).optional(),
  serviceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
  externalRef: z.string().max(200).optional(),
});

export type WebhookBody = z.infer<typeof WebhookBodySchema>;
