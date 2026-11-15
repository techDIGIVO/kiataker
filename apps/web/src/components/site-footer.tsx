import { Logo } from "./brand";

export function SiteFooter() {
  return (
    <footer style={{ background: "#0B2018", color: "#C7D6CD", padding: "60px 0 36px" }}>
      <div className="container footer-grid">
        <div>
          <Logo color="#fff" />
          <p style={{ color: "#9FB4A9", marginTop: 14, maxWidth: 320, fontSize: 14.5 }}>
            Collect your rent, we&apos;ll handle the rest. A landlord-first rental management platform for Nigeria.
          </p>
        </div>
        <div>
          <h4 style={{ color: "#fff", fontSize: 14, marginBottom: 14, letterSpacing: "0.04em" }}>Product</h4>
          <FooterLink href="/#how">How it works</FooterLink>
          <FooterLink href="/#handles">What we handle</FooterLink>
          <FooterLink href="/konnect">For providers</FooterLink>
        </div>
        <div>
          <h4 style={{ color: "#fff", fontSize: 14, marginBottom: 14, letterSpacing: "0.04em" }}>Company</h4>
          <FooterLink href="/terms">Terms</FooterLink>
          <FooterLink href="/privacy">Privacy</FooterLink>
          <FooterLink href="/mandate">Mandate</FooterLink>
        </div>
      </div>
      <div className="container" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 40, paddingTop: 22, fontSize: 13.5, color: "#8CA296" }}>
        KIA TAKER LTD. Rent settles directly to the landlord through a licensed payment partner.
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ display: "block", color: "#C7D6CD", fontSize: 14.5, padding: "5px 0" }}>
      {children}
    </a>
  );
}
