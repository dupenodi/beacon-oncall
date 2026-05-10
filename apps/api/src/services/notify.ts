import { Resend } from "resend";

export type NotifyPayload = {
  to: string;
  subject: string;
  text: string;
};

export type Notifier = {
  send(input: NotifyPayload): Promise<void>;
};

export function createConsoleNotifier(): Notifier {
  return {
    async send(input: NotifyPayload): Promise<void> {
      if (process.env.DEBUG_NOTIFY === "1") {
        console.log("[notify]", { to: input.to, subject: input.subject });
      }
    },
  };
}

export function createResendNotifier(): Notifier {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required for Resend");
  }
  const resend = new Resend(apiKey);
  return {
    async send(input: NotifyPayload): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
  };
}

/** Uses Resend when `RESEND_API_KEY` + `EMAIL_FROM` are set; otherwise console (dev). */
export function createNotifier(): Notifier {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    return createResendNotifier();
  }
  return createConsoleNotifier();
}
