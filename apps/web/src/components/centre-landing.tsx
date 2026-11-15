"use client";

import { AdminShell, Section } from "@/components/admin-ui";

export interface CentreLink {
  label: string;
  href: string;
  description: string;
}

/** A Command Centre landing page: a titled set of shortcut cards to the boards it owns (P0-07). */
export function CentreLanding({ active, title, subtitle, groups }: { active: string; title: string; subtitle: string; groups: { heading: string; links: CentreLink[] }[] }) {
  return (
    <AdminShell active={active} title={title} subtitle={subtitle}>
      {groups.map((g) => (
        <Section key={g.heading} title={g.heading}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, padding: 16 }}>
            {g.links.map((l) => (
              <a key={l.href} href={l.href} className="card" style={{ padding: 16, textDecoration: "none", display: "block" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--k-text-primary)", marginBottom: 4 }}>{l.label}</div>
                <div style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{l.description}</div>
              </a>
            ))}
          </div>
        </Section>
      ))}
    </AdminShell>
  );
}
