"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface NoticeRow {
  id: string;
  status: string;
  property: string | null;
  tenant: string | null;
  effectiveDate: string | null;
  delivery: string | null;
  contentHash: string | null;
  createdAt: string;
}

export default function NoticesBoard() {
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<NoticeRow[]>("/internal/board/notices")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function physicalService(id: string) {
    if (!window.confirm("Request physical service by a litigation clerk for this notice?")) return;
    setBusy(id); setError(""); setNotice("");
    try { await apiSend("POST", `/internal/notices/${id}/physical-service`, {}); setNotice("Physical service requested; the team will coordinate it."); load(); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(""); }
  }

  const dispatched = rows.filter((r) => r.status === "DISPATCHED").length;
  const instructed = rows.filter((r) => r.status === "INSTRUCTED").length;

  return (
    <AdminShell active="notices" title="Notices" subtitle="Notices issued by KIA TAKER LTD as the landlord's agent (GJ-07). Delivery is recorded truthfully.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading notices...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Notices" value={rows.length} />
            <StatCard label="Awaiting approval" value={instructed} tone={instructed > 0 ? "warn" : "ok"} />
            <StatCard label="Dispatched" value={dispatched} />
          </div>

          <Section title="All notices" subtitle="Instruction and approval happen on the landlord's side; a notice is sealed with a content hash on dispatch.">
            {rows.length === 0 ? (
              <Empty>No notices yet.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Status", "Effective", "Delivery", "Seal", "Action"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone={statusTone(r.status)}>{r.status}</Tag></Td>
                    <Td>{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : "None"}</Td>
                    <Td>{r.delivery ? <Tag tone={r.delivery.startsWith("sent") ? "info" : "muted"}>{r.delivery}</Tag> : "None"}</Td>
                    <Td mono>{r.contentHash ? `${r.contentHash.slice(0, 10)}…` : "None"}</Td>
                    <Td>
                      {r.status === "DISPATCHED" ? (
                        <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.id} onClick={() => physicalService(r.id)}>Physical service</button>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>None</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
          <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>
            &quot;sent, not confirmed&quot; is shown exactly as recorded: an electronic send is not proof of delivery (BP-16).
          </p>
        </>
      )}
    </AdminShell>
  );
}
