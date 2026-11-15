import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell>
      <section className="section">
        <div className="container" style={{ textAlign: "center", maxWidth: 560 }}>
          <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 72, color: "var(--k-green-primary)", lineHeight: 1 }}>404</div>
          <h1 style={{ fontSize: 28, margin: "12px 0 10px" }}>This page could not be found</h1>
          <p style={{ fontSize: 17, marginBottom: 28 }}>The page you are looking for does not exist or has moved.</p>
          <a className="btn btn-primary" href="/">Back to home</a>
        </div>
      </section>
    </PageShell>
  );
}
