"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Origination {
  id: string;
  tenancyId: string;
  status: string;
  property: string | null;
  tenant: string | null;
  gates: { termsSet: boolean; tenantAccepted: boolean; cautionFeeSettled: boolean };
  ready: boolean;
  createdAt: string;
}

function Gate({ on, label }: { on: boolean; label: string }) {
  return <Tag tone={on ? "ok" : "muted"}>{on ? "✓" : "○"} {label}</Tag>;
}

export default function OriginationsBoard() {
  const [rows, setRows] = useState<Origination[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Origination[]>("/internal/board/originations")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function activate(id: string) {
    if (!window.confirm("Activate this tenancy now? This starts management and the rent schedule.")) return;
    setBusy(id); setError(""); setNotice("");
    try { await apiSend("POST", `/internal/originations/${id}/activate`, {}); setNotice("Tenancy activated."); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const inFlight = rows.filter((r) => r.status !== "ACTIVATED").length;
  const ready = rows.filter((r) => r.ready && r.status !== "ACTIVATED").length;

  return (
    <AdminShell active="originations" title="New tenancies" subtitle="Originations in flight (GJ-05). Each passes every gate, then the landlord activates it atomically.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading originations...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="In flight" value={inFlight} />
            <StatCard label="Ready to activate" value={ready} tone={ready > 0 ? "warn" : "ok"} />
          </div>

          <Section title="Originations" subtitle="Gates: terms set, tenant accepted, caution fee settled. Staff can activate a ready origination on the landlord's behalf (concierge).">
            {rows.length === 0 ? (
              <Empty>No originations yet.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Status", "Gates", "Started", "Action"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone={statusTone(r.status)}>{r.status}</Tag></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Gate on={r.gates.termsSet} label="Terms" />
                        <Gate on={r.gates.tenantAccepted} label="Tenant" />
                        <Gate on={r.gates.cautionFeeSettled} label="Caution fee" />
                      </div>
                    </Td>
                    <Td>{new Date(r.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      {r.status === "ACTIVATED" ? (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>Activated</span>
                      ) : (
                        <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busy === r.id || !r.ready} title={r.ready ? "" : "All gates must be green first"} onClick={() => activate(r.id)}>
                          {busy === r.id ? "..." : "Activate"}
                        </button>
                      )}
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
