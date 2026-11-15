"use client";
import { CentreLanding } from "@/components/centre-landing";

export default function CeoCentre() {
  return (
    <CentreLanding
      active="ceo"
      title="CEO Command Centre"
      subtitle="Oversight and governance. CEO members are super-admins with access to every centre and the team."
      groups={[
        {
          heading: "Govern",
          links: [
            { label: "CEO sign-off", href: "/admin/sign-off", description: "Approve or decline high-risk control changes (two-person rule)." },
            { label: "Team & access", href: "/admin/team", description: "Add, suspend or remove staff and assign Command Centre access." },
            { label: "Platform controls", href: "/admin", description: "Every feature control and its risk level, from the Operations overview." },
          ],
        },
        {
          heading: "See everything",
          links: [
            { label: "Operations", href: "/admin", description: "The operations overview, queues and boards." },
            { label: "Accounts", href: "/admin/accounts", description: "Money: payments, statements, arrears, reconciliation." },
            { label: "Legal & Compliance", href: "/admin/legal", description: "Notices, documents, templates, data requests." },
            { label: "Product", href: "/admin/product", description: "Landing page, integrations and the AI agent." },
          ],
        },
      ]}
    />
  );
}
