"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Request {
  id: string;
  reference: string;
  kind: string;
  subjectName: string;
  status: string;
  refusedReason: string | null;
  fulfilledAt: string | null;
  createdAt: string;
}

export default function NdpaBoard() {
  const [rows, setRows] = useState<Request[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await apiGet<Request[]>("/internal/board/data-requests");
      setRows(r);
      setLoading(false);
    } catch (err) {
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
      else {
        setError((err as Error).message);
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refuse(id: string) {
    const reason = window.prompt("Reason for declining this data request (e.g. identity not established, or a legal exemption applies):");
    if (!reason) return;
    try {
      await apiSend("POST", `/internal/data-requests/${id}/refuse`, { reason });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pending = rows.filter((r) => r.status === "RECEIVED").length;
  const erasures = rows.filter((r) => r.kind === "ERASURE").length;

  return (
    <AdminShell active="ndpa" title="Data requests" subtitle="NDPA access and erasure requests (GJ-19). Identity is proven on a secure link before any data is disclosed or erased. Erasure keeps records the law requires.">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading data requests...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="All requests" value={rows.length} />
            <StatCard label="Awaiting the subject" value={pending} tone={pending ? "warn" : undefined} />
            <StatCard label="Erasure requests" value={erasures} />
          </div>

          <Section title="Requests" subtitle="A person asks for a copy of their data or for it to be erased. They confirm identity on a secure link; staff can decline with a reason.">
            {rows.length === 0 ? (
              <Empty>No data requests yet.</Empty>
            ) : (
              <Table head={["Reference", "Person", "Kind", "Status", "Raised", "Action"]}>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td mono>{r.reference}</Td>
                    <Td>{r.subjectName}</Td>
                    <Td><Tag tone={r.kind === "ERASURE" ? "warn" : "info"}>{r.kind === "ERASURE" ? "Erasure" : "Access"}</Tag></Td>
                    <Td>
                      <Tag tone={statusTone(r.status)}>{r.status}</Tag>
                      {r.refusedReason && <div style={{ fontSize: 12, color: "var(--k-text-muted)", marginTop: 4 }}>{r.refusedReason}</div>}
                    </Td>
                    <Td>{new Date(r.createdAt).toLocaleDateString()}</Td>
                    <Td>
                      {r.status === "RECEIVED" ? (
                        <button className="btn btn-outline" style={{ height: 34, fontSize: 13 }} onClick={() => refuse(r.id)}>Decline</button>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{r.status === "FULFILLED" ? "Fulfilled" : "No action"}</span>
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
