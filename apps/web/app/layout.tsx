import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "beacon-oncall",
  description: "Incident routing and escalation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 24 }}>{children}</body>
    </html>
  );
}
