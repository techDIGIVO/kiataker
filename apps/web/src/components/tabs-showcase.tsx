"use client";

import { useState } from "react";
import {
  IconRecord, IconConfirm, IconWatch, IconDecision, IconPrepare, IconSettle, IconEvidence, IconChat,
} from "./icons";

const ICONS: Record<string, (p: { size?: number }) => React.ReactNode> = {
  record: IconRecord, confirm: IconConfirm, watch: IconWatch, decision: IconDecision,
  prepare: IconPrepare, settle: IconSettle, evidence: IconEvidence, chat: IconChat,
};

export interface Tab {
  label: string;
  bubble?: string; // bubble-<colour> key: green | ivory | mint | sky | peach | char
  icon?: string;
  title: string;
  body: string;
  points?: string[];
  buttonLabel?: string;
  buttonHref?: string;
  image?: string;
  chip?: string;
}

/** Segmented-tab feature showcase: each tab reveals a coloured rounded bubble with a
 *  floating UI collage. Switches with a smooth roll-in (Mainstack-style). */
export function TabsShowcase({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const t = tabs[active] ?? tabs[0];
  if (!t) return null;
  const Icon = ICONS[t.icon ?? "record"] ?? IconRecord;
  const dark = t.bubble === "green" || t.bubble === "char";

  return (
    <div>
      <div className="tabs-control">
        {tabs.map((tab, i) => (
          <button key={i} data-active={i === active} onClick={() => setActive(i)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`tab-panel bubble bubble-${t.bubble ?? "ivory"}`} key={active}>
        <div className="two-grid" style={{ alignItems: "center" }}>
          <div>
            <div className="bubble-icon" style={{ color: "var(--k-green-primary)" }}><Icon size={26} /></div>
            <h3 style={{ fontSize: "clamp(24px,3vw,32px)", marginBottom: 12, color: dark ? "#fff" : "var(--k-text-primary)" }}>{t.title}</h3>
            <p style={{ fontSize: 16.5, marginBottom: 18, color: dark ? "rgba(255,255,255,.85)" : "var(--k-text-secondary)", maxWidth: 420 }}>{t.body}</p>
            {t.points && (
              <ul style={{ display: "grid", gap: 9, listStyle: "none", marginBottom: 22 }}>
                {t.points.map((p) => (
                  <li key={p} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 15, color: dark ? "rgba(255,255,255,.92)" : "var(--k-text-primary)" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 999, background: dark ? "rgba(255,255,255,.2)" : "var(--k-green-soft)", color: dark ? "#fff" : "var(--k-green-primary)", display: "grid", placeItems: "center", flex: "none" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
            {t.buttonLabel && (
              <a className={dark ? "btn btn-light" : "btn btn-primary"} href={t.buttonHref ?? "#"}>{t.buttonLabel}</a>
            )}
          </div>

          <div className="collage">
            {t.image && (
              <div className="collage-card zoom" style={{ padding: 0, overflow: "hidden", inset: "10% 4% 10% 10%", position: "absolute", borderRadius: 18 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt={t.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            {t.chip && (
              <div className="collage-card" style={{ right: 0, bottom: "14%", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--k-green-primary)" }} />
                {t.chip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
