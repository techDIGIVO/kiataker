"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, fmtNaira } from "@/components/admin-ui";

interface ArrearRow {
  tenancyId: string;
  property: string | null;
  tenant: string | null;
  overdueCount: number;
  arrearsKobo: string;
  oldestDue: string;
}

export default function RentBoard() {
  const [rows, setRows] = useState<ArrearRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<ArrearRow | null>(null);

  function load() {
    return apiGet<ArrearRow[]>("/internal/board/arrears")
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

  const totalArrears = rows.reduce((s, r) => s + BigInt(r.arrearsKobo), 0n);

  return (
    <AdminShell active="rent" title="Rent & arrears" subtitle="Overdue rent across every managed tenancy. Rent settles directly to the landlord; Kiataker only records it (BP-07).">
      {error && <Banner tone="warn">{error}</Banner>}
      {loading ? (
        <Banner>Loading arrears...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Tenancies in arrears" value={rows.length} tone={rows.length > 0 ? "warn" : "ok"} />
            <StatCard label="Total arrears" value={fmtNaira(totalArrears)} tone={totalArrears > 0n ? "warn" : "ok"} />
          </div>

          <Section title="Arrears" subtitle="Record an off-platform payment on the landlord's behalf against the oldest unpaid period.">
            {rows.length === 0 ? (
              <Empty>No arrears. Every managed tenancy is up to date.</Empty>
            ) : (
              <Table head={["Property", "Tenant", "Overdue periods", "Arrears", "Oldest due", ""]}>
                {rows.map((r) => (
                  <tr key={r.tenancyId}>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td><Tag tone="warn">{r.overdueCount}</Tag></Td>
                    <Td>{fmtNaira(r.arrearsKobo)}</Td>
                    <Td>{new Date(r.oldestDue).toLocaleDateString()}</Td>
                    <Td>
                      <button className="btn btn-outline" style={{ height: 34, fontSize: 13, padding: "0 14px" }} onClick={() => setPaying(r)}>
                        Record payment
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {paying && (
            <RecordPayment
              row={paying}
              onClose={() => setPaying(null)}
              ondone={() => {
                setPaying(null);
                load();
              }}
            />
          )}
        </>
      )}
    </AdminShell>
  );
}

function RecordPayment({ row, onClose, ondone }: { row: ArrearRow; onClose: () => void; ondone: () => void }) {
  const [amountNaira, setAmountNaira] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function record() {
    if (!amountNaira) {
      setMsg("Enter the amount received.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const amountKobo = BigInt(Math.round(Number(amountNaira) * 100)).toString();
      await apiSend("POST", "/internal/rent/record", { tenancyId: row.tenancyId, amountKobo, reference: reference || undefined });
      onDoneSafe();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }
  function onDoneSafe() {
    setBusy(false);
    ondone();
  }

  return (
    <Section title="Record an off-platform payment" subtitle={`${row.property ?? "Tenancy"} · ${row.tenant ?? ""}`}>
      <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 440 }}>
        {msg && <Banner tone="warn">{msg}</Banner>}
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--k-text-muted)" }}>Amount received (₦)</span>
          <input value={amountNaira} onChange={(e) => setAmountNaira(e.target.value)} type="number" placeholder="200000" style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--k-text-muted)" }}>Reference (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank transfer ref" style={inputStyle} />
        </label>
        <p style={{ fontSize: 12.5, color: "var(--k-text-muted)" }}>
          This records a payment made directly to the landlord and issues a receipt. Kiataker never holds the money.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" style={{ height: 40, padding: "0 18px" }} disabled={busy} onClick={record}>
            {busy ? "Recording..." : "Record payment"}
          </button>
          <button className="btn btn-outline" style={{ height: 40, padding: "0 18px" }} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Section>
  );
}

const inputStyle: React.CSSProperties = { height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 12px", fontSize: 14 };
