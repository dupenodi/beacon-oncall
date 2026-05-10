"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { API_BASE } from "@/lib/api";

function BeaconIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
    </svg>
  );
}

const NAV = [
  {
    section: "Operations",
    links: [
      {
        slug: "incidents",
        label: "Incidents",
        path: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        ),
      },
      {
        slug: "services",
        label: "Services",
        path: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
          />
        ),
      },
      {
        slug: "policies",
        label: "Escalation Policies",
        path: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"
          />
        ),
      },
    ],
  },
  {
    section: "Configuration",
    links: [
      {
        slug: "settings",
        label: "Settings",
        path: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
        ),
      },
    ],
  },
];

export default function Sidebar({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const base = `/orgs/${orgSlug}`;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <BeaconIcon />
        </div>
        <div>
          <div className="sidebar-logo-name">Beacon</div>
          <span className="sidebar-logo-sub">On-call</span>
        </div>
      </div>

      <div className="sidebar-org">
        <div className="sidebar-org-label">Organization</div>
        <div className="sidebar-org-name">{orgSlug}</div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.section} style={{ marginBottom: 8 }}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.links.map((link) => {
              const href = `${base}/${link.slug}`;
              const active = pathname.startsWith(href);
              return (
                <Link key={link.slug} href={href} className={`sidebar-link ${active ? "active" : ""}`}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    {link.path}
                  </svg>
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginBottom: 8 }}>
          <div className="sidebar-section-label">Public</div>
          <Link
            href={`/public/${orgSlug}/status`}
            className="sidebar-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253M3 12a8.959 8.959 0 01.284-2.253"
              />
            </svg>
            Status Page ↗
          </Link>
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: "100%", justifyContent: "flex-start" }}
          onClick={async () => {
            await fetch(`${API_BASE}/v1/auth/logout`, { method: "POST", credentials: "include" });
            window.location.href = "/login";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
