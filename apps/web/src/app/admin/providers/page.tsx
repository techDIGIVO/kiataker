"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, statusTone } from "@/components/admin-ui";

interface Provider {
  id: string;
  name: string;
  services: string;
  status: string;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
}

export default function ProvidersBoard() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [link, setLink] = useState<string | null>(null);

  function load() {
    return apiGet<Provider[]>("/internal/board/providers")
      .then((r) => {
        setRows(r);
        setLoading(false);
      })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else {
          setError((err as Error).message);
          setLoading(false);
        }
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function admit(id: string) {
    setBusyId(id);
    setError("");
    setLink(null);
    try {
      const res = await apiSend<{ workspaceUrl: string }>("POST", `/internal/providers/${id}/admit`, {});
      setLink(res.workspaceUrl);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId("");
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError("");
    try {
      await apiSend("POST", `/internal/providers/${id}/reject`, {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId("");
    }
  }

  const applied = rows.filter((r) => r.status === "APPLIED").length;
  const admitted = rows.filter((r) => r.status === "ADMITTED").length;

  return (
    <AdminShell active="providers" title="Providers" subtitle="Konnect service providers (GJ-10). They apply, you admit them, then they quote and deliver Work from their own workspace.">
      {error && <Banner tone="warn">{error}</Banner>}
      {link && (
        <Banner>
          Admitted. Provider workspace link: <span style={{ fontFamily: "var(--k-font-mono)", fontSize: 13 }}>{link}</span>
        </Banner>
      )}
      {loading ? (
        <Banner>Loading providers...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Applications" value={applied} tone={applied > 0 ? "warn" : "ok"} />
            <StatCard label="Admitted" value={admitted} />
          </div>

          <Section title="Providers" subtitle="Admit a provider to give them a workspace; reject to decline.">
            {rows.length === 0 ? (
              <Empty>No provider applications yet.</Empty>
            ) : (
              <Table head={["Name", "Services", "Contact", "Status", ""]}>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td>{p.services}</Td>
                    <Td>{p.contactEmail ?? p.contactPhone ?? "None"}</Td>
                    <Td><Tag tone={statusTone(p.status === "ADMITTED" ? "ACTIVE" : p.status === "REJECTED" ? "DISPUTED" : p.status)}>{p.status}</Tag></Td>
                    <Td>
                      {p.status === "APPLIED" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busyId === p.id} onClick={() => admit(p.id)}>Admit</button>
                          <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busyId === p.id} onClick={() => reject(p.id)}>Reject</button>
                        </div>
                      ) : p.status === "ADMITTED" ? (
                        <button className="btn btn-outline" style={{ height: 32, fontSize: 12.5, padding: "0 12px" }} disabled={busyId === p.id} onClick={() => admit(p.id)}>New link</button>
                      ) : (
                        "None"
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
