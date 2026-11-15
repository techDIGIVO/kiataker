import type { Metadata } from "next";
import { ContentPage, Clause } from "@/components/content-page";

export const metadata: Metadata = { title: "Privacy Notice | Kiataker" };

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Notice"
      intro="How KIA TAKER LTD collects and protects personal data, under the Nigeria Data Protection Act 2023 (NDPA)."
    >
      <Clause heading="1. What we collect">
        We collect only what a feature needs: your contact details, the property and tenancy records you create, and the evidence attached to them. Each field carries its purpose and legal basis.
      </Clause>
      <Clause heading="2. How it is protected">
        Phone numbers and emails are stored encrypted, with a separate hash used only for lookup. Personal data is kept out of logs and analytics.
      </Clause>
      <Clause heading="3. Your rights">
        You may request access, correction, erasure or object to processing. Requests are answered within 30 days. Tenants and others without an account can make a request through a secure link.
      </Clause>
      <Clause heading="4. Retention">
        Data is kept only as long as needed or as the law requires. Records the law requires us to keep are retained and isolated rather than rewritten.
      </Clause>
    </ContentPage>
  );
}
