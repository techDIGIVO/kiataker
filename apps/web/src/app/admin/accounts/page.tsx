"use client";
import { CentreLanding } from "@/components/centre-landing";

export default function AccountsCentre() {
  return (
    <CentreLanding
      active="accounts"
      title="Accounts Command Centre"
      subtitle="Money in and out: on-platform payments, statements, arrears and reconciliation. Kiataker never holds funds (BP-07)."
      groups={[
        {
          heading: "Money",
          links: [
            { label: "Payments", href: "/admin/payments", description: "On-platform payments, the split, refunds and the pay link." },
            { label: "Statements", href: "/admin/statements", description: "Landlord rent statements: charged, collected, net and outstanding." },
            { label: "Rent & arrears", href: "/admin/rent", description: "Arrears board and recording off-platform payments." },
            { label: "Reconciliation", href: "/admin/reconciliation", description: "Resolve disputed tenancies." },
            { label: "Fees & keys", href: "/admin/ai", description: "The coordination fee and the Paystack keys." },
          ],
        },
      ]}
    />
  );
}
