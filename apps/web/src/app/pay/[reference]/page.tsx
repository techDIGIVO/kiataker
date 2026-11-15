"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

interface PublicCheckout {
  reference: string;
  status: string;
  mode: string;
  amountKobo: string;
  property: string | null;
  authorizationUrl: string | null;
}

function naira(kobo: string): string {
  const n = BigInt(kobo || "0");
  return `₦${(n / 100n).toLocaleString("en-NG")}.${(n % 100n).toString().padStart(2, "0")}`;
}

export default function PayPage() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const [checkout, setCheckout] = useState<PublicCheckout | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/payments/${reference}/public`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "This payment link is not valid");
      setCheckout(json);
      if (json.status === "SUCCESS") setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  async function pay() {
    if (!checkout) return;
    // Live mode hands off to the PSP's own hosted page.
    if (checkout.mode !== "fake" && checkout.authorizationUrl) {
      window.location.href = checkout.authorizationUrl;
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/v1/payments/${reference}/dev-complete`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Payment could not be completed");
      setDone(true);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--k-surface-muted)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ padding: 32, maxWidth: 440, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <LogoMark color="var(--k-green-primary)" />
          <span style={{ fontFamily: "var(--k-font-heading)", fontWeight: 700, fontSize: 19 }}>kiataker</span>
        </div>

        {error && !checkout && <p style={{ color: "var(--k-warning-fg)", fontSize: 14 }}>{error}</p>}

        {checkout && (
          <>
            {done ? (
              <>
                <h1 style={{ fontSize: 22, marginBottom: 8 }}>Payment received</h1>
                <p style={{ fontSize: 14, color: "var(--k-text-secondary)", marginBottom: 16 }}>
                  Thank you. Your rent of {naira(checkout.amountKobo)} has been settled to your landlord. A receipt has been issued.
                </p>
                <div style={{ background: "var(--k-green-soft)", color: "var(--k-green-deep)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5 }}>
                  Kiataker never holds your money. Rent settles directly to your landlord; we only coordinate and record it.
                </div>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 22, marginBottom: 6 }}>Pay your rent</h1>
                {checkout.property && <p style={{ fontSize: 14, color: "var(--k-text-muted)", marginBottom: 16 }}>{checkout.property}</p>}
                <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 36, marginBottom: 20 }}>{naira(checkout.amountKobo)}</div>
                {error && <p style={{ color: "var(--k-warning-fg)", fontSize: 13.5, marginBottom: 12 }}>{error}</p>}
                <button className="btn btn-primary" style={{ width: "100%", height: 48, fontSize: 16 }} disabled={busy} onClick={pay}>
                  {busy ? "Processing..." : checkout.mode === "fake" ? "Pay now (test mode)" : "Pay with Paystack"}
                </button>
                <p style={{ fontSize: 12.5, color: "var(--k-text-muted)", marginTop: 14, textAlign: "center" }}>
                  {checkout.mode === "fake"
                    ? "Test mode: this simulates a successful Paystack payment."
                    : "You will be taken to Paystack's secure checkout."}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
