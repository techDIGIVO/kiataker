import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { IconChat, IconDecision, IconPrepare, IconSettle, IconWatch, IconEvidence } from "@/components/icons";

export const metadata: Metadata = {
  title: "Konnect for Service Providers | Kiataker",
  description:
    "Offer inspections, repairs and field services to managed landlords on Kiataker Konnect. See opportunities, quote, deliver with evidence and get paid.",
};

const WHATSAPP_LINK = "https://wa.me/2349065009370?text=" + encodeURIComponent("I want to join Konnect as a provider");

const steps = [
  { bubble: "ivory", icon: IconChat, n: "01", title: "Apply to join", body: "Tell us about your firm and the services you offer. Our team reviews and admits you." },
  { bubble: "mint", icon: IconDecision, n: "02", title: "See opportunities", body: "Managed landlords request services. Matching opportunities arrive on your Konnect link." },
  { bubble: "sky", icon: IconPrepare, n: "03", title: "Quote and deliver", body: "Submit a Quote, do the Work, and attach evidence as you go." },
  { bubble: "peach", icon: IconSettle, n: "04", title: "Get paid", body: "Once the landlord accepts the Work, payment settles to your account." },
];

const services = [
  { tint: "mint", icon: IconWatch, text: "Inspections and surveys" },
  { tint: "sky", icon: IconPrepare, text: "Repairs and maintenance" },
  { tint: "peach", icon: IconSettle, text: "Cleaning and fumigation" },
  { tint: "green", icon: IconEvidence, text: "Condition checks and handover" },
  { tint: "ivory", icon: IconDecision, text: "Security and facility services" },
  { tint: "mint", icon: IconChat, text: "Document service and field visits" },
];

const TINT: Record<string, { bg: string; fg: string }> = {
  mint: { bg: "#EAF7F0", fg: "#178a5e" },
  sky: { bg: "#EAF1F7", fg: "#1E4E79" },
  peach: { bg: "#FBF0EC", fg: "#A4502E" },
  ivory: { bg: "#F5F1E4", fg: "#8A5B00" },
  green: { bg: "var(--k-green-soft)", fg: "var(--k-green-primary)" },
};

export default function KonnectPage() {
  return (
    <PageShell>
      {/* Hero (slides under the floating header) */}
      <section className="hero" style={{ marginTop: -82 }}>
        <div className="hero-orbs" aria-hidden="true">
          <div className="hero-ring r1" /><div className="hero-ring r2" /><div className="hero-ring r3" />
          <div className="hero-orb o1" /><div className="hero-orb o3" />
        </div>
        <div className="container" style={{ position: "relative", zIndex: 1, padding: "128px 24px 80px", maxWidth: 840 }}>
          <span className="overline on-dark">Kiataker Konnect</span>
          <h1 style={{ color: "#fff", fontSize: "clamp(36px, 5.2vw, 58px)", margin: "20px 0 16px", fontWeight: 800 }}>
            Grow your business with <span style={{ color: "#9FE0C1" }}>managed landlords</span>
          </h1>
          <p style={{ color: "#E7F1EC", fontSize: 19, maxWidth: 560, marginBottom: 30 }}>
            Konnect is the provider workspace for Kiataker. Offer inspections, repairs and field services to landlords whose properties are already under management, with clear scope, evidence and prompt payment.
          </p>
          <a className="btn btn-light" href={WHATSAPP_LINK}>Join as a Service Provider</a>
        </div>
      </section>

      {/* How it works: coloured bubble cards */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 48px" }}>
            <h2 style={{ fontSize: "clamp(30px,4.2vw,44px)", marginBottom: 14 }}>How Konnect <span className="hl-muted">works</span></h2>
            <p style={{ fontSize: 18 }}>From application to payment, with the landlord&apos;s decision and your evidence on record at every step.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {steps.map((s) => {
              const Icon = s.icon;
              const tint = TINT[s.bubble === "green" ? "green" : s.bubble]!;
              return (
                <div key={s.n} className={`bubble bubble-${s.bubble}`} style={{ padding: 30, boxShadow: "0 16px 40px rgba(20,32,24,.08)" }}>
                  <div className="bubble-icon" style={{ color: "var(--k-green-primary)", width: 50, height: 50, marginBottom: 16 }}><Icon size={24} /></div>
                  <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 15, color: tint.fg, marginBottom: 4 }}>{s.n}</div>
                  <h3 style={{ fontSize: 19, marginBottom: 8 }}>{s.title}</h3>
                  <p style={{ fontSize: 14.5 }}>{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services + fee */}
      <section className="section-sm">
        <div className="container">
          <div className="two-grid" style={{ alignItems: "center" }}>
            <div className="bubble bubble-ivory">
              <h2 style={{ fontSize: "clamp(26px,3.4vw,36px)", marginBottom: 20 }}>Services landlords request</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {services.map((s) => {
                  const Icon = s.icon;
                  const tint = TINT[s.tint]!;
                  return (
                    <div key={s.text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15.5, fontWeight: 500 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 11, background: tint.bg, color: tint.fg, display: "grid", placeItems: "center", flex: "none" }}><Icon size={19} /></span>
                      {s.text}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bubble bubble-green">
              <h3 style={{ fontSize: 24, marginBottom: 12, color: "#fff" }}>Fair and transparent</h3>
              <p style={{ fontSize: 16.5, marginBottom: 16, color: "rgba(255,255,255,.88)" }}>
                You set your own Quote. Kiataker charges a 10% coordination fee on completed Work, only when the landlord accepts it and you are paid.
              </p>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.7)" }}>
                Provider admission opens with the Konnect launch. Apply now and we will notify you when your workspace is ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-sm">
        <div className="container">
          <div className="bubble bubble-char" style={{ textAlign: "center", padding: "60px 40px" }}>
            <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", marginBottom: 12, color: "#fff" }}>Ready to join Konnect?</h2>
            <p style={{ fontSize: 17, maxWidth: 460, margin: "0 auto 26px", color: "rgba(255,255,255,.85)" }}>Start your application on WhatsApp and our team will be in touch.</p>
            <a className="btn btn-light" href={WHATSAPP_LINK}>Join as a Service Provider</a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
