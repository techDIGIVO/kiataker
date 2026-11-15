"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, fmtNaira } from "@/components/admin-ui";

interface Closeout {
  id: string;
  tenancyId: string;
  status: string;
  property: string | null;
  tenant: string | null;
  cautionFeeKobo: string;
  deductionsKobo: string;
  outcome: string;
  refundKobo: string;
  createdAt: string;
}

function outcomeTone(outcome: string): "ok" | "warn" | "muted" | "info" {
  if (outcome === "REFUND") return "ok";
  if (outcome === "FORFEIT") return "warn";
  if (outcome === "PARTIAL") return "info";
  return "muted";
}

export default function CloseoutsBoard() {
  const [rows, setRows] = useState<Closeout[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Closeout[]>("/internal/board/closeouts")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id); setError(""); setNotice("");
    try { await fn(); setNotice(ok); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }
  function addDeduction(id: string) {
    const reason = window.prompt("Deduction reason (e.g. unpaid rent, damage):");
    if (!reason) return;
    const naira = window.prompt("Amount in naira:");
    if (!naira || !Number.isFinite(Number(naira))) return;
    const amountKobo = String(Math.round(Number(naira) * 100));
    act(id, () => apiSend("POST", `/internal/closeouts/${id}/deductions`, { reason, amountKobo }), "Deduction added.");
  }
  function settle(id: string) {
    if (!window.confirm("Settle this close-out? This records the final caution-fee outcome.")) return;
    act(id, () => apiSend("POST", `/internal/closeouts/${id}/settle`, {}), "Close-out settled.");
  }

  const open = rows.filter((r) => r.status === "OPEN").length;
  const refundTotal = rows.filter((r) => r.status === "SETTLED").reduce((s, r) => s + BigInt(r.refundKobo), 0n);

  return (
    <AdminShell active="closeouts" title="Close-outs" subtitle="Ending tenancies and the caution-fee outcome (GJ-13). Kiataker records the settlement; it never holds the money (BP-07).">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading close-outs...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Open" value={open} tone={open > 0 ? "warn" : "ok"} />
            <StatCard label="Refunded to tenants" value={fmtNaira(refundTotal)} />
          </div>

          <Section title="Close-outs" subtitle="Caution fee minus deductions gives the outcome. Staff can record deductions and settle on the landlord's behalf (concierge).">
            {rows.length === 0 ? (
              <Empty>No close-outs yet.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Status", "Caution fee", "Deductions", "Outcome", "Refund", "Actions"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone={r.status === "SETTLED" ? "ok" : "muted"}>{r.status}</Tag></Td>
                    <Td>{fmtNaira(r.cautionFeeKobo)}</Td>
                    <Td>{fmtNaira(r.deductionsKobo)}</Td>
                    <Td><Tag tone={outcomeTone(r.outcome)}>{r.outcome || "pending"}</Tag></Td>
                    <Td>{fmtNaira(r.refundKobo)}</Td>
                    <Td>
                      {r.status === "OPEN" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.id} onClick={() => addDeduction(r.id)}>Deduct</button>
                          <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.id} onClick={() => settle(r.id)}>Settle</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>Settled</span>
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
