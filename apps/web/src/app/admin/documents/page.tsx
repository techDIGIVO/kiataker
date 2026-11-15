"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface Doc {
  id: string;
  reference: string;
  type: string;
  title: string;
  status: string;
  contentHash: string | null;
  signatures: { role: string; status: string; method: string }[];
  createdAt: string;
}

export default function DocumentsBoard() {
  const [rows, setRows] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    apiGet<Doc[]>("/internal/board/documents")
      .then((r) => { setRows(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  function recordPaper(id: string) {
    const signerRole = window.prompt("Signer role (LANDLORD, TENANT or WITNESS):", "TENANT");
    if (!signerRole) return;
    const signerName = window.prompt("Signer name (optional):") ?? undefined;
    setBusy(id); setError(""); setNotice("");
    apiSend("POST", `/internal/documents/${id}/paper-signature`, { signerRole: signerRole.toUpperCase(), signerName })
      .then(() => { setNotice("Paper signature recorded."); load(); })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(""));
  }

  const sealed = rows.filter((r) => r.status === "SEALED").length;
  const signed = rows.filter((r) => r.status === "SIGNED").length;

  return (
    <AdminShell active="documents" title="Documents" subtitle="Sealed, signable, publicly verifiable documents (GJ-06, GJ-14). Each carries a content-hash seal.">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading documents...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Documents" value={rows.length} />
            <StatCard label="Awaiting signatures" value={sealed} tone={sealed > 0 ? "warn" : "ok"} />
            <StatCard label="Fully signed" value={signed} />
          </div>

          <Section title="All documents" subtitle="Verify any of these publicly at /verify/<reference>; the seal makes tampering evident.">
            {rows.length === 0 ? (
              <Empty>No documents yet.</Empty>
            ) : (
              <Table head={["Reference", "Title", "Status", "Signatures", "Seal", "PDF"]}>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <Td mono>{d.reference}</Td>
                    <Td>{d.title}</Td>
                    <Td><Tag tone={statusTone(d.status)}>{d.status}</Tag></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {d.signatures.map((s, i) => (
                          <Tag key={i} tone={s.status === "SIGNED" ? "ok" : "muted"}>
                            {s.status === "SIGNED" ? "✓" : "○"} {s.role.toLowerCase()}
                          </Tag>
                        ))}
                      </div>
                    </Td>
                    <Td mono>{d.contentHash ? `${d.contentHash.slice(0, 10)}…` : "none"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <a href={`${API_BASE}/v1/verify/${d.reference}/pdf`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--k-green-primary)", fontWeight: 600 }}>
                          Download
                        </a>
                        {d.status !== "SIGNED" && (
                          <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === d.id} onClick={() => recordPaper(d.id)}>Record paper</button>
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
