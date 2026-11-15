"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface View {
  accepted: boolean;
  tenant: string | null;
  property: string | null;
  rentKobo: string | null;
  frequency: string | null;
  commencementDate: string | null;
}

function naira(kobo: string | null): string {
  if (!kobo) return "";
  const n = BigInt(kobo);
  return `₦${(n / 100n).toLocaleString("en-NG")}`;
}

export default function AcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/originations/accept/${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This link is not valid");
      setView(json);
      if (json.accepted) setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/originations/accept/${token}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not accept");
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 460, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {error && !view && <p style={{ color: "var(--k-warning-fg)", fontSize: 14 }}>{error}</p>}

        {view && (
          done ? (
            <>
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>Terms accepted</h1>
              <p style={{ fontSize: 14, color: "var(--k-text-secondary)" }}>
                Thank you{view.tenant ? `, ${view.tenant}` : ""}. Your landlord has been notified and can now activate the tenancy.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 22, marginBottom: 6 }}>Review your tenancy</h1>
              {view.property && <p style={{ fontSize: 14, color: "var(--k-text-muted)", marginBottom: 16 }}>{view.property}</p>}
              <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                <Row label="Tenant" value={view.tenant ?? "you"} />
                <Row label="Rent" value={`${naira(view.rentKobo)}${view.frequency ? ` / ${view.frequency}` : ""}`} />
                {view.commencementDate && <Row label="Starts" value={new Date(view.commencementDate).toLocaleDateString()} />}
              </div>
              {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-primary" style={{ width: "100%", height: 48, fontSize: 16 }} disabled={busy} onClick={accept}>
                {busy ? "Submitting..." : "Accept these terms"}
              </button>
              <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 14, textAlign: "center" }}>
                Accepting confirms the terms above. Your landlord activates the tenancy after you accept.
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, borderBottom: "1px solid var(--k-border)", paddingBottom: 8 }}>
      <span style={{ color: "var(--k-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}
