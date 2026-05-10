import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beacon — Incident Management",
  description: "On-call alerting and incident escalation",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath fill='%23FF9500' d='M17 4 8.5 15.5H15L14 30l8.5-11.5H17z'/%3E%3C/svg%3E",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
