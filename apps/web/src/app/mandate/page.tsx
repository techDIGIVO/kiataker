import type { Metadata } from "next";
import { ContentPage, Clause } from "@/components/content-page";

export const metadata: Metadata = { title: "Management Mandate | Kiataker" };

export default function MandatePage() {
  return (
    <ContentPage
      title="Management Mandate"
      intro="The Mandate appoints KIA TAKER LTD as the landlord's duly authorised agent to manage a property. The landlord accepts it together with the Terms when creating an account."
    >
      <Clause heading="1. Appointment">
        The landlord appoints KIA TAKER LTD to coordinate the management of each onboarded property. Authority covers only the premises in each onboarded Property File.
      </Clause>
      <Clause heading="2. The landlord decides">
        Kiataker prepares and coordinates. Every notice, approval and payment release stays the landlord&apos;s decision. Kiataker never takes a management decision on the landlord&apos;s behalf.
      </Clause>
      <Clause heading="3. Fees">
        Fees are disclosed and accepted with this Mandate. Kiataker earns only from evidenced service outcomes, never from access to records.
      </Clause>
      <Clause heading="4. Notices and representation">
        Where a notice is required, KIA TAKER LTD may issue it as the landlord&apos;s authorised agent, signed by the assigned Portfolio Manager, on the landlord&apos;s instruction.
      </Clause>
    </ContentPage>
  );
}
