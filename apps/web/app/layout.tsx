import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beacon — Incident Management",
  description: "On-call alerting and incident escalation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
