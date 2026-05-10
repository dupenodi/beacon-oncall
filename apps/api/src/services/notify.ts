/** CP05+ replaces with Resend; CP03 uses a no-op success path. */
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
