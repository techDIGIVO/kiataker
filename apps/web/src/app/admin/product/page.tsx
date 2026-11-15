"use client";
import { CentreLanding } from "@/components/centre-landing";

export default function ProductCentre() {
  return (
    <CentreLanding
      active="product"
      title="Product Management Command Centre"
      subtitle="The public product and the platform's integrations: the landing page, the AI agent, and the channels."
      groups={[
        {
          heading: "Product",
          links: [
            { label: "Landing page", href: "/admin/pages/home", description: "Edit and publish the public site with the visual builder." },
            { label: "Integrations & keys", href: "/admin/ai", description: "The WhatsApp AI agent, provider/model, keys and the live test." },
            { label: "WhatsApp channel", href: "/admin/whatsapp", description: "Templates, quiet hours and the notification queue." },
          ],
        },
        {
          heading: "Operations of the platform",
          links: [
            { label: "Support inbox", href: "/admin/inbox", description: "Read and reply to WhatsApp conversations." },
            { label: "Job queue", href: "/admin/jobs", description: "Durable scheduled work." },
          ],
        },
      ]}
    />
  );
}
