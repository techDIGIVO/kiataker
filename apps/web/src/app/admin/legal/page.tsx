"use client";
import { CentreLanding } from "@/components/centre-landing";

export default function LegalCentre() {
  return (
    <CentreLanding
      active="legal"
      title="Legal & Compliance Command Centre"
      subtitle="Notices, documents, counsel-approved templates and data-protection (NDPA) requests."
      groups={[
        {
          heading: "Documents & notices",
          links: [
            { label: "Notices", href: "/admin/notices", description: "Issued notices, truthful delivery and physical service." },
            { label: "Documents", href: "/admin/documents", description: "Sealed documents, signatures and PDF download." },
            { label: "Template studio", href: "/admin/templates", description: "Author and counsel-approve notice and agreement templates." },
          ],
        },
        {
          heading: "Compliance",
          links: [
            { label: "Data requests", href: "/admin/ndpa", description: "NDPA access and erasure requests." },
            { label: "Quality (QMS)", href: "/admin/qms", description: "Review Property Files and sign off their quality." },
            { label: "Control sign-off", href: "/admin/sign-off", description: "High-risk control changes awaiting a CEO decision." },
          ],
        },
      ]}
    />
  );
}
