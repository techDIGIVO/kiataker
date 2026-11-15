import type { Metadata } from "next";
import { ContentPage, Clause } from "@/components/content-page";

export const metadata: Metadata = { title: "Terms of Use | Kiataker" };

export default function TermsPage() {
  return (
    <ContentPage
      title="Terms of Use"
      intro="These terms govern your use of Kiataker, the platform of KIA TAKER LTD. A landlord accepts them together with the management Mandate when creating an account."
    >
      <Clause heading="1. The service">
        Kiataker is a landlord-first rental property management platform. The landlord is the principal and keeps every reserved decision. Kiataker runs the operating workflow and keeps an evidence-backed history of each property.
      </Clause>
      <Clause heading="2. No custody of money">
        Rent always settles directly to the landlord&apos;s account through a licensed payment partner. Kiataker never holds rent, deposits or any customer money.
      </Clause>
      <Clause heading="3. Your account">
        You confirm the information you provide is accurate. Records you create are confirmed with the tenant, who never receives an account and only confirms, disputes or corrects their own information.
      </Clause>
      <Clause heading="4. Acceptable use">
        You agree to use Kiataker lawfully and not to misrepresent a property, a tenancy or a person. Evidence and completed history are preserved and cannot be deleted.
      </Clause>
    </ContentPage>
  );
}
