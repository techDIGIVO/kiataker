import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/** Shared chrome for content pages (Konnect, Terms, Privacy, Mandate, 404). */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
