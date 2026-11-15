"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, fmtNaira, statusTone } from "@/components/admin-ui";

interface Landlord { id: string; displayName: string }
interface Row {
  tenancyId: string;
  property: string;
  tenant: string | null;
  status: string;
  chargedKobo: string;
  collectedKobo: string;
  netToLandlordKobo: string;
  outstandingKobo: string;
}
interface Statement {
  landlord: string;
  generatedAt: string;
  totals: { properties: number; tenancies: number; chargedKobo: string; collectedKobo: string; feesKobo: string; netToLandlordKobo: string; outstandingKobo: string };
  tenancies: Row[];
}

export default function StatementsBoard() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [landlordId, setLandlordId] = useState("");
  const [statement, setStatement] = useState<Statement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Landlord[]>("/internal/landlords")
      .then((r) => { setLandlords(r); setLoading(false); })
      .catch((err) => {
        if (["UNAUTHENTICATED", "FORBIDDEN"].includes((err as Error).message)) window.location.href = "/admin/login";
        else { setError((err as Error).message); setLoading(false); }
      });
  }, []);

  async function pull(id: string) {
    setLandlordId(id); setStatement(null); setError("");
    if (!id) return;
    try { setStatement(await apiGet<Statement>(`/internal/statements/${id}`)); }
    catch (err) { setError((err as Error).message); }
  }

  const t = statement?.totals;

  return (
    <AdminShell active="statements" title="Statements" subtitle="Landlord rent statements (Information output, P4): charged, collected, settled and outstanding, with a per-tenancy breakdown.">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading...</Banner>
      ) : (
        <>
          <Section title="Pick a landlord">
            <div style={{ padding: 16 }}>
              <select aria-label="Landlord" value={landlordId} onChange={(e) => pull(e.target.value)} style={{ height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 10px", fontSize: 14, background: "#fff", minWidth: 280 }}>
                <option value="">Select a landlord…</option>
                {landlords.map((l) => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
            </div>
          </Section>

          {statement && t && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
                <StatCard label="Charged" value={fmtNaira(t.chargedKobo)} />
                <StatCard label="Collected" value={fmtNaira(t.collectedKobo)} />
                <StatCard label="Net to landlord" value={fmtNaira(t.netToLandlordKobo)} />
                <StatCard label="Outstanding" value={fmtNaira(t.outstandingKobo)} tone={BigInt(t.outstandingKobo) > 0n ? "warn" : "ok"} />
              </div>

              <Section title={`Statement for ${statement.landlord}`} subtitle={`${t.properties} propert${t.properties === 1 ? "y" : "ies"}, ${t.tenancies} tenanc${t.tenancies === 1 ? "y" : "ies"} · generated ${new Date(statement.generatedAt).toLocaleString()}`}>
                {statement.tenancies.length === 0 ? (
                  <Empty>No tenancies for this landlord yet.</Empty>
                ) : (
                  <Table head={["Property", "Tenant", "Status", "Charged", "Collected", "Net", "Outstanding"]}>
                    {statement.tenancies.map((r) => (
                      <tr key={r.tenancyId}>
                        <Td>{r.property}</Td>
                        <Td>{r.tenant ?? "None"}</Td>
                        <Td><Tag tone={statusTone(r.status)}>{r.status}</Tag></Td>
                        <Td>{fmtNaira(r.chargedKobo)}</Td>
                        <Td>{fmtNaira(r.collectedKobo)}</Td>
                        <Td>{fmtNaira(r.netToLandlordKobo)}</Td>
                        <Td>{fmtNaira(r.outstandingKobo)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Section>
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
