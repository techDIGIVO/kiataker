"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface Scope {
  propertyId: string;
  property: string | null;
  status: string;
  version: number;
  services: { rentCollection: boolean; maintenance: boolean; notices: boolean; inspections: boolean; renewals: boolean };
}

const LABELS: Record<string, string> = { rentCollection: "Rent", maintenance: "Maintenance", notices: "Notices", inspections: "Inspections", renewals: "Renewals" };

export default function ScopeBoard() {
  const [rows, setRows] = useState<Scope[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Scope[]>("/internal/board/scope")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setScope(propertyId: string, preset: "full" | "rent") {
    const services = preset === "full"
      ? { rentCollection: true, maintenance: true, notices: true, inspections: true, renewals: true }
      : { rentCollection: true, maintenance: false, notices: false, inspections: false, renewals: false };
    setBusy(propertyId); setError(""); setNotice("");
    try { await apiSend("PUT", `/internal/scope/${propertyId}`, services); setNotice(preset === "full" ? "Scope set to full management." : "Scope set to rent collection only."); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  return (
    <AdminShell active="scope" title="Scope of management" subtitle="What Kiataker manages for each property (SOM-01, GJ-20). A property with no explicit scope defaults to full management.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading scopes...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Agreed scopes" value={rows.length} />
          </div>

          <Section title="Agreed scopes" subtitle="Each capability checks its service is in scope before it runs. Landlords set the scope per property.">
            {rows.length === 0 ? (
              <Empty>No scopes agreed yet. Every property defaults to full management.</Empty>
            ) : (
              <Table head={["Property", "Version", "Services in scope", "Set"]}>
                {rows.map((r) => (
                  <tr key={r.propertyId}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>v{r.version}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(r.services).map(([k, on]) => (
                          <Tag key={k} tone={on ? "ok" : "muted"}>{on ? "✓" : "○"} {LABELS[k] ?? k}</Tag>
                        ))}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.propertyId} onClick={() => setScope(r.propertyId, "full")}>Full</button>
                        <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.propertyId} onClick={() => setScope(r.propertyId, "rent")}>Rent only</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        </>
      )}
    </AdminShell>
  );
}
