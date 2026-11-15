import type { PageContent } from "./types";

const WA = "https://wa.me/2349065009370?text=" + encodeURIComponent("Hello Kiataker");
const img = (id: string, w = 1100) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** The default Kiataker landing page as CMS blocks. Visual-first, rounded "bubble" sections
 *  with colour and character, a tabbed showcase, and a live WhatsApp demo. */
export const DEFAULT_HOME: PageContent = {
  blocks: [
    {
      id: "hero",
      type: "hero",
      style: { background: "green" },
      props: {
        overline: "Landlord-first. Built for Nigeria.",
        heading: "Collect your rent, we'll handle the rest.",
        subhead: "Run your properties by chat. Rent settles straight to your account, you keep the decisions.",
        primaryLabel: "Chat with Kiataker",
        primaryHref: WA,
        showStoreBadges: true,
        qr: true,
        qrText: "Scan to chat on WhatsApp",
        phone: true,
        chips: ["Rent received", "Tenant confirmed"],
        image: img("1600585154340-be6161a56a0c"),
        stats: [
          { big: "Direct settlement", small: "Rent reaches your account" },
          { big: "Evidence on every step", small: "A record you can rely on" },
          { big: "Any phone", small: "Everything by chat" },
        ],
      },
    },
    {
      id: "tabs",
      type: "tabs",
      style: { background: "canvas", paddingTop: 100, paddingBottom: 100 },
      props: {
        anchor: "handles",
        heading: "One platform, <span class='hl-muted'>built around how you actually manage</span>",
        subhead: "From the record to the rent, Kiataker runs the work and keeps the evidence.",
        tabs: [
          {
            label: "Record", bubble: "ivory", icon: "record", title: "Record your property",
            body: "Set up a property and its tenancy as you state them, in a few short steps.",
            points: ["Guided, three-tap setup", "Residential, commercial or mixed use", "Management starts at once"],
            buttonLabel: "Add a property", buttonHref: WA, image: img("1600585154340-be6161a56a0c"), chip: "Property File created",
          },
          {
            label: "Confirm", bubble: "mint", icon: "confirm", title: "Confirm with the tenant",
            body: "The tenant confirms the record on WhatsApp. No tenant account, ever.",
            points: ["Tenant confirms, disputes or corrects", "Base-truth on record", "You stay in control"],
            buttonLabel: "See how it works", buttonHref: "#how", image: img("1600566753086-00f18fb6b3ea"), chip: "Tenant confirmed",
          },
          {
            label: "Collect", bubble: "green", icon: "settle", title: "Collect your rent",
            body: "Rent settles directly to your account through a licensed payment partner. Kiataker never holds your money.",
            points: ["Direct settlement", "Receipts on record", "No wallet, no custody"],
            buttonLabel: "Chat with Kiataker", buttonHref: WA, image: img("1600607687920-4e2a09cf159d"), chip: "Rent received",
          },
          {
            label: "Protect", bubble: "sky", icon: "evidence", title: "Keep the evidence",
            body: "Every notice, approval and payment leaves an evidence trail you and your lawyer can rely on.",
            points: ["Tamper-evident history", "Notices from approved templates", "Condition checks on record"],
            buttonLabel: "Learn more", buttonHref: "#how", image: img("1600596542815-ffad4c1539a9"), chip: "Evidence secured",
          },
        ],
      },
    },
    {
      id: "simulator",
      type: "simulator",
      style: { background: "mint", bubble: true },
      props: {
        heading: "Experience the technology",
        subhead: "Talk to Kiataker right here, no download needed. Ask in plain words, tap the menu, and watch it work.",
        points: ["Understands plain language", "Guided, human conversation", "The real engine behind the chat"],
      },
    },
    {
      id: "steps",
      type: "steps",
      style: { background: "ivory", bubble: true },
      props: {
        anchor: "how",
        heading: "Managed in three steps",
        subhead: "Start on WhatsApp. Kiataker does the rest.",
        image: img("1600607687920-4e2a09cf159d"),
        items: [
          { n: "01", title: "Say hello on WhatsApp", body: "Create your account in one chat." },
          { n: "02", title: "Add a property", body: "Record it. Management starts at once." },
          { n: "03", title: "We handle the rest", body: "Rent, renewals, notices, evidence." },
        ],
      },
    },
    {
      id: "bento",
      type: "bento",
      style: { background: "sky", bubble: true },
      props: {
        heading: "A clear record for every property",
        subhead: "The property, the tenancy and the money, all on record.",
        images: [
          { src: img("1600596542815-ffad4c1539a9"), caption: "Properties", tall: true },
          { src: img("1600607687920-4e2a09cf159d", 700), caption: "Tenancies" },
          { src: img("1600566753086-00f18fb6b3ea", 700), caption: "Condition checks" },
          { src: img("1600585154340-be6161a56a0c", 900), caption: "Evidence timeline", wide: true },
        ],
      },
    },
    {
      id: "provider",
      type: "providerBand",
      style: { background: "canvas", paddingTop: 72, paddingBottom: 72 },
      props: {
        heading: "Offer your services on Konnect",
        body: "Inspections, repairs and field services for managed landlords.",
        buttonLabel: "Join as a Service Provider",
        buttonHref: "/konnect",
        image: img("1600566753086-00f18fb6b3ea"),
      },
    },
    {
      id: "cta",
      type: "cta",
      style: { background: "green", bubble: true },
      props: {
        heading: "Collect your rent, we'll handle the rest.",
        subhead: "Start in one message.",
        buttonLabel: "Chat with Kiataker",
        buttonHref: WA,
      },
    },
  ],
};
