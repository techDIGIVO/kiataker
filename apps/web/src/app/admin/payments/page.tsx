"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/admin-api";
import { AdminShell, StatCard, Section, Table, Td, Tag, Banner, Empty, fmtNaira, statusTone } from "@/components/admin-ui";

interface PaymentRow {
  reference: string | null;
  status: string;
  amountKobo: string;
  feeKobo: string;
  netKobo: string;
  property: string | null;
  tenant: string | null;
  createdAt: string;
  paidAt: string | null;
}
interface ArrearRow {
  tenancyId: string;
  property: string | null;
  tenant: string | null;
  arrearsKobo: string;
}
interface CheckoutResult {
  reference: string;
  mode: string;
  amountKobo: string;
  feeKobo: string;
  netKobo: string;
  authorizationUrl: string;
}

export default function PaymentsBoard() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [arrears, setArrears] = useState<ArrearRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tenancyId, setTenancyId] = useState("");
  const [link, setLink] = useState<CheckoutResult | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  function load() {
    return Promise.all([apiGet<PaymentRow[]>("/internal/board/payments"), apiGet<ArrearRow[]>("/internal/board/arrears")])
      .then(([p, a]) => {
        setRows(p);
        setArrears(a);
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

  async function createLink() {
    if (!tenancyId) {
      setError("Pick a tenancy in arrears first.");
      return;
    }
    setCreating(true);
    setError("");
    setLink(null);
    try {
      const res = await apiSend<CheckoutResult>("POST", "/internal/payments/checkout", { tenancyId });
      setLink(res);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function act(reference: string, path: string, confirmMsg: string, ok: string) {
    if (!window.confirm(confirmMsg)) return;
    setBusy(reference); setError(""); setNotice("");
    try { await apiSend("POST", `/internal/payments/${reference}/${path}`, {}); setNotice(ok); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  const settled = rows.filter((r) => r.status === "SUCCESS");
  const settledTotal = settled.reduce((s, r) => s + BigInt(r.netKobo), 0n);
  const feeTotal = settled.reduce((s, r) => s + BigInt(r.feeKobo), 0n);
  const pending = rows.filter((r) => r.status === "PENDING").length;

  return (
    <AdminShell active="payments" title="Payments" subtitle="On-platform rent through a Paystack split. The net settles directly to the landlord; Kiataker never holds the money (BP-07, GJ-12).">
      {error && <Banner tone="warn">{error}</Banner>}
      {notice && <Banner>{notice}</Banner>}
      {loading ? (
        <Banner>Loading payments...</Banner>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
            <StatCard label="Settled to landlords" value={fmtNaira(settledTotal)} />
            <StatCard label="Coordination fees" value={fmtNaira(feeTotal)} />
            <StatCard label="Pending" value={pending} tone={pending > 0 ? "warn" : "ok"} />
          </div>

          <Section title="Raise a payment link" subtitle="Generate a hosted checkout for a tenant to pay a due charge. The split is computed up front.">
            <div style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
              <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
                <span style={{ color: "var(--k-text-muted)" }}>Tenancy in arrears</span>
                <select value={tenancyId} onChange={(e) => setTenancyId(e.target.value)} style={{ height: 40, borderRadius: 9, border: "1px solid var(--k-border)", padding: "0 10px", fontSize: 14, background: "#fff" }}>
                  <option value="">Select a tenancy…</option>
                  {arrears.map((a) => (
                    <option key={a.tenancyId} value={a.tenancyId}>
                      {(a.property ?? a.tenancyId)}{a.tenant ? ` · ${a.tenant}` : ""} · {fmtNaira(a.arrearsKobo)} due
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" style={{ height: 40, width: "fit-content", padding: "0 18px" }} disabled={creating} onClick={createLink}>
                {creating ? "Creating..." : "Create payment link"}
              </button>
              {arrears.length === 0 && <p style={{ fontSize: 13, color: "var(--k-text-muted)" }}>No tenancies in arrears right now.</p>}
              {link && (
                <div style={{ border: "1px solid var(--k-border)", borderRadius: 10, padding: 14, display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Checkout {link.reference} ({link.mode} mode)</div>
                  <div style={{ fontSize: 13.5 }}>
                    Amount {fmtNaira(link.amountKobo)} · fee {fmtNaira(link.feeKobo)} · to landlord {fmtNaira(link.netKobo)}
                  </div>
                  <a href={link.authorizationUrl} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ height: 36, width: "fit-content", padding: "0 14px", fontSize: 13 }}>
                    Open the tenant pay page →
                  </a>
                </div>
              )}
            </div>
          </Section>

          <Section title="Payments" subtitle="Each payment shows the split: the fee Kiataker coordinates and the net that settles to the landlord.">
            {rows.length === 0 ? (
              <Empty>No on-platform payments yet.</Empty>
            ) : (
              <Table head={["Reference", "Property", "Tenant", "Amount", "Fee", "To landlord", "Status", "Actions"]}>
                {rows.map((r) => (
                  <tr key={r.reference}>
                    <Td mono>{r.reference}</Td>
                    <Td>{r.property ?? "None"}</Td>
                    <Td>{r.tenant ?? "None"}</Td>
                    <Td>{fmtNaira(r.amountKobo)}</Td>
                    <Td>{fmtNaira(r.feeKobo)}</Td>
                    <Td>{fmtNaira(r.netKobo)}</Td>
                    <Td><Tag tone={statusTone(r.status)}>{r.status}</Tag></Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {r.status === "PENDING" && r.reference && (
                          <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.reference} onClick={() => act(r.reference!, "dev-complete", "Mark this test checkout as paid?", "Marked as paid.")}>Mark paid (test)</button>
                        )}
                        {r.status === "SUCCESS" && r.reference && (
                          <button className="btn btn-outline" style={{ height: 30, fontSize: 12, padding: "0 10px" }} disabled={busy === r.reference} onClick={() => act(r.reference!, "refund", "Refund this payment? It records the reversal and reopens the charge; Kiataker holds no money.", "Payment refunded.")}>Refund</button>
                        )}
                        {r.status !== "PENDING" && r.status !== "SUCCESS" && <span style={{ fontSize: 13, color: "var(--k-text-muted)" }}>{r.status === "REFUNDED" ? "Refunded" : ""}</span>}
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
