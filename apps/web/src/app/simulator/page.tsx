import { WhatsAppSim } from "@/components/whatsapp-sim";

export default function SimulatorPage() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(170deg, var(--k-green-deep), var(--k-green-primary))", display: "grid", placeItems: "center", padding: "32px 16px" }}>
      <div style={{ textAlign: "center", color: "#fff", marginBottom: 22, maxWidth: 420 }}>
        <h1 style={{ color: "#fff", fontSize: 26, marginBottom: 8 }}>Try Kiataker on WhatsApp</h1>
        <p style={{ color: "#CFE6DA", fontSize: 15 }}>Type like you would to a person. Try &quot;add a property&quot; or &quot;what needs my decision&quot;.</p>
      </div>
      <WhatsAppSim />
      <a href="/" style={{ color: "#CFE6DA", fontSize: 14, marginTop: 20 }}>← Back to site</a>
    </main>
  );
}
