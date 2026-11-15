"use client";

import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/admin-api";
import { LogoMark } from "@/components/brand";

/** Nav for the admin. Built tools are links; the other Command Centres are marked "soon"
 *  so the admin honestly shows what is in place and what is not (the user asked for this). */
const NAV: { group: string; items: { key: string; label: string; href?: string }[] }[] = [
  {
    group: "Operations Command Centre",
    items: [
      { key: "overview", label: "Overview", href: "/admin" },
      { key: "buildings", label: "Buildings", href: "/admin/buildings" },
      { key: "intake", label: "Bulk intake", href: "/admin/intake" },
      { key: "originations", label: "New tenancies", href: "/admin/originations" },
      { key: "condition", label: "Condition checks", href: "/admin/condition" },
      { key: "konnect", label: "Konnect & maintenance", href: "/admin/konnect" },
      { key: "providers", label: "Providers", href: "/admin/providers" },
      { key: "rent", label: "Rent & arrears", href: "/admin/rent" },
      { key: "payments", label: "Payments", href: "/admin/payments" },
      { key: "closeouts", label: "Close-outs", href: "/admin/closeouts" },
      { key: "notices", label: "Notices", href: "/admin/notices" },
      { key: "renewals", label: "Renewals", href: "/admin/renewals" },
      { key: "documents", label: "Documents", href: "/admin/documents" },
      { key: "templates", label: "Template studio", href: "/admin/templates" },
      { key: "reconciliation", label: "Reconciliation", href: "/admin/reconciliation" },
      { key: "scope", label: "Scope of management", href: "/admin/scope" },
    ],
  },
  {
    group: "Platform",
    items: [
      { key: "integrations", label: "Integrations & keys", href: "/admin/ai" },
      { key: "whatsapp", label: "WhatsApp channel", href: "/admin/whatsapp" },
      { key: "inbox", label: "Support inbox", href: "/admin/inbox" },
      { key: "jobs", label: "Job queue", href: "/admin/jobs" },
      { key: "signoff", label: "CEO sign-off", href: "/admin/sign-off" },
      { key: "ndpa", label: "Data requests", href: "/admin/ndpa" },
      { key: "pages", label: "Landing page", href: "/admin/pages/home" },
    ],
  },
  {
    group: "Other Command Centres (soon)",
    items: [
      { key: "ceo", label: "CEO" },
      { key: "product", label: "Product Management" },
      { key: "legal", label: "Legal & Compliance" },
      { key: "accounts", label: "Accounts" },
    ],
  },
];

export function AdminShell({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/admin/login";
      return;
    }
    setReady(true);
  }, []);

  function signOut() {
    clearToken();
    window.location.href = "/admin/login";
  }

  if (!ready) return null;

  return (
    <div className="admin-shell" style={{ background: "var(--k-surface-muted)" }}>
      <aside className="admin-side" style={{ background: "var(--k-green-deep)", color: "#fff", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px 10px" }}>
          <LogoMark color="#fff" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>
        {NAV.map((section) => (
          <div key={section.group}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8FC4AC", padding: "0 10px 8px" }}>
              {section.group}
            </div>
            <nav style={{ display: "grid", gap: 3 }}>
              {section.items.map((item) => {
                const isActive = item.key === active;
                const disabled = !item.href;
                const base = { padding: "10px 12px", borderRadius: 9, fontSize: 14.5, display: "block", textDecoration: "none" } as const;
                if (disabled) {
                  return (
                    <div key={item.key} style={{ ...base, color: "#A9CDBB", cursor: "not-allowed", fontWeight: 500 }} aria-disabled="true">
                      {/* "soon" items: lighter than active links but still AA-contrast on the deep-green rail */}
                      {item.label}
                    </div>
                  );
                }
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    style={{
                      ...base,
                      fontWeight: isActive ? 600 : 500,
                      background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
                      color: isActive ? "#fff" : "#C7E4D5",
                    }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        ))}
        <button
          onClick={signOut}
          style={{ marginTop: "auto", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, height: 42, cursor: "pointer", fontWeight: 600 }}
        >
          Sign out
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26 }}>{title}</h1>
            <p style={{ fontSize: 14 }}>{subtitle}</p>
          </div>
          {actions && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

/** ₦ from a kobo string (100 kobo = ₦1). Truthful money formatting, no rounding surprises. */
export function fmtNaira(kobo: string | bigint): string {
  const n = typeof kobo === "bigint" ? kobo : BigInt(kobo || "0");
  const naira = n / 100n;
  const k = n % 100n;
  const withCommas = naira.toLocaleString("en-NG");
  return `₦${withCommas}.${k.toString().padStart(2, "0")}`;
}

export function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 13, color: "var(--k-text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 30, color: tone === "warn" ? "var(--k-warning-fg)" : "var(--k-text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, marginBottom: 2 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13.5, marginBottom: 14 }}>{subtitle}</p>}
      <div className="card" style={{ overflow: "hidden", marginTop: subtitle ? 0 : 12 }}>{children}</div>
    </section>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 560 }}>
        <thead>
          <tr style={{ background: "var(--k-surface-muted)" }}>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "11px 16px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--k-text-muted)", fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td style={{ padding: "12px 16px", borderTop: "1px solid var(--k-border)", fontFamily: mono ? "var(--k-font-mono)" : "inherit", fontSize: mono ? 13 : 14, verticalAlign: "top" }}>
      {children}
    </td>
  );
}

export function Tag({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "muted" | "info" }) {
  const map = {
    ok: { bg: "var(--k-green-soft)", fg: "var(--k-green-primary)" },
    warn: { bg: "var(--k-warning-bg)", fg: "var(--k-warning-fg)" },
    muted: { bg: "var(--k-surface-muted)", fg: "var(--k-text-secondary)" },
    info: { bg: "#E6F0FB", fg: "#1D5FA8" },
  } as const;
  const c = map[tone];
  return <span style={{ background: c.bg, color: c.fg, padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

export function Banner({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 20, borderLeft: tone === "warn" ? "3px solid var(--k-warning-fg)" : undefined }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, color: "var(--k-text-muted)", textAlign: "center" }}>{children}</div>;
}

/** Status → tag tone, shared across the boards. */
export function statusTone(status: string): "ok" | "warn" | "muted" | "info" {
  const s = status.toUpperCase();
  if (["COMPLETED", "PAID", "TENANT_CONFIRMED", "CONFIRMED", "DISPATCHED", "RECONCILED", "ACTIVE", "APPROVED", "SENT", "FULFILLED"].includes(s)) return "ok";
  if (["OVERDUE", "ESCALATED", "TENANT_DISPUTED", "DISPUTED", "URGENT", "REJECTED", "SKIPPED", "REFUSED", "REFUNDED"].includes(s)) return "warn";
  if (["IN_PROGRESS", "QUOTING", "COMPLETION_SUBMITTED", "INSTRUCTED", "SUBMITTED", "QUEUED", "DEFERRED", "AWAITING_TENANT", "RECEIVED", "PENDING", "APPLIED", "RUNNING"].includes(s)) return "info";
  return "muted";
}
