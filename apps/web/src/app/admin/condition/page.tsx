"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Check {
  id: string;
  kind: string;
  status: string;
  property: string | null;
  tenant: string | null;
  itemCount: number;
  createdAt: string;
}

export default function ConditionBoard() {
  const [rows, setRows] = useState<Check[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Check[]>("/internal/board/condition-checks")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(id: string) {
    setBusy(id); setError(""); setNotice("");
    try { const r = await apiSend<{ confirmUrl: string }>("POST", `/internal/condition-checks/${id}/send`, {}); setNotice(`Sent to tenant. Link: ${r.confirmUrl}`); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }
  async function compare(id: string) {
    setBusy(id); setError(""); setNotice("");
    try { const r = await apiGet<{ changedCount: number; rows: { area: string; baseline: string; exit: string; changed: boolean }[] }>(`/internal/condition-checks/${id}/compare`); setNotice(`${r.changedCount} area(s) changed vs the baseline: ` + r.rows.filter((x) => x.changed).map((x) => `${x.area} (${x.baseline}→${x.exit})`).join(", ") || "no changes"); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const awaiting = rows.filter((r) => r.status === "AWAITING_TENANT").length;
  const disputed = rows.filter((r) => r.status === "DISPUTED").length;

  return (
    <AdminShell active="condition" title="Condition checks" subtitle="Handover baselines and exit checks (GJ-08). Tenants confirm or dispute; an exit check is compared to the baseline.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading condition checks...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Checks" value={rows.length} />
            <StatCard label="Awaiting tenant" value={awaiting} tone={awaiting > 0 ? "warn" : "ok"} />
            <StatCard label="Disputed" value={disputed} tone={disputed > 0 ? "warn" : "ok"} />
          </div>

          <Section title="All condition checks" subtitle="A confirmed baseline anchors the move-out comparison and the close-out deductions.">
            {rows.length === 0 ? (
              <Empty>No condition checks yet.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Kind", "Status", "Items", "Actions"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone={r.kind === "EXIT" ? "info" : "muted"}>{r.kind}</Tag></Td>
                    <Td><Tag tone={statusTone(r.status)}>{r.status}</Tag></Td>
                    <Td>{r.itemCount}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(r.status === "DRAFT" || r.status === "AWAITING_TENANT") && (
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.id} onClick={() => send(r.id)}>Send to tenant</button>
                        )}
                        {r.kind === "EXIT" && (
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 10px" }} disabled={busy === r.id} onClick={() => compare(r.id)}>Compare</button>
                        )}
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
