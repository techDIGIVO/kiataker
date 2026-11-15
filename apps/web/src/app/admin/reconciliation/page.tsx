"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty } from "@/components/admin-ui";

interface DisputeRow {
  tenancyId: string;
  property: string | null;
  tenant: string | null;
  status: string;
  updatedAt: string;
}

export default function ReconciliationQueue() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    return apiGet<DisputeRow[]>("/internal/board/reconciliations")
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

  async function reconcile(tenancyId: string) {
    setBusyId(tenancyId);
    setError("");
    try {
      await apiSend("POST", `/internal/tenancies/${tenancyId}/reconcile`, {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell active="reconciliation" title="Reconciliation" subtitle="Tenancies a tenant has disputed. Reconcile after separating the landlord's record from the tenant's (BP-06, GJ-04).">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading disputes...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Open disputes" value={rows.length} tone={rows.length > 0 ? "warn" : "ok"} />
          </div>

          <Section title="Disputed tenancies" subtitle="Resolving a dispute closes the related Action Centre item for the landlord.">
            {rows.length === 0 ? (
              <Empty>No open disputes. Every record is agreed.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Status", "Raised", ""]}>
                {rows.map((r) => (
                  <tr key={r.tenancyId}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone="warn">{r.status}</Tag></Td>
                    <Td>{new Date(r.updatedAt).toLocaleDateString()}</Td>
                    <Td>
                      <button className="btn btn-primary" style={{ height: 34, fontSize: 13, padding: "0 14px" }} disabled={busyId === r.tenancyId} onClick={() => reconcile(r.tenancyId)}>
                        {busyId === r.tenancyId ? "Reconciling..." : "Reconcile"}
                      </button>
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
