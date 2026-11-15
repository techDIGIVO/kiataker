import { PageShell } from "./page-shell";

export function ContentPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <PageShell>
      <section style={{ background: "var(--k-surface-muted)", borderBottom: "1px solid var(--k-border)" }}>
        <div className="container" style={{ padding: "56px 24px", maxWidth: 820 }}>
          <h1 style={{ fontSize: "clamp(30px,4vw,44px)", marginBottom: 12 }}>{title}</h1>
          <p style={{ fontSize: 18 }}>{intro}</p>
        </div>
      </section>
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 760 }}>
          {children}
          <p style={{ marginTop: 32, fontSize: 13.5, color: "var(--k-text-muted)", borderTop: "1px solid var(--k-border)", paddingTop: 20 }}>
            This is the controlling document, managed and versioned by KIA TAKER LTD. The current version and its effective date are shown when you accept it in Kiataker.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

export function Clause({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>{heading}</h2>
      <p style={{ fontSize: 15.5 }}>{children}</p>
    </div>
  );
}
