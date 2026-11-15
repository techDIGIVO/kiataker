import type { Block, BlockType } from "./types";
import { newId } from "./types";

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "image"
  | "select"
  | "number"
  | "boolean"
  | "repeater"
  | "stringlist";

export interface FieldDef {
  key: string; // supports dotted paths e.g. "card.reference"
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  itemFields?: FieldDef[]; // for repeater
  itemLabel?: string;
  placeholder?: string;
}

const ICON_OPTIONS = [
  "record",
  "confirm",
  "watch",
  "decision",
  "prepare",
  "settle",
  "evidence",
  "chat",
].map((v) => ({ value: v, label: v }));

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  stats: "Stat row",
  heading: "Heading",
  text: "Text",
  image: "Image",
  video: "Video",
  imageText: "Image + text",
  features: "Feature grid",
  steps: "Steps",
  bento: "Image gallery",
  tabs: "Feature tabs",
  simulator: "WhatsApp demo",
  cta: "Call to action",
  providerBand: "Provider band",
  spacer: "Spacer",
};

/** Editable fields per block type (the style fields are added separately). */
export const FIELD_SCHEMA: Record<BlockType, FieldDef[]> = {
  hero: [
    { key: "overline", label: "Overline", type: "text" },
    { key: "heading", label: "Heading", type: "textarea" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    { key: "primaryLabel", label: "Button label", type: "text" },
    { key: "primaryHref", label: "Button link", type: "text" },
    { key: "phone", label: "Show animated phone", type: "boolean" },
    { key: "image", label: "Image (when phone is off)", type: "image" },
    { key: "qr", label: "Show WhatsApp QR card", type: "boolean" },
    { key: "qrText", label: "QR caption", type: "text" },
    { key: "showStoreBadges", label: "Show store badges", type: "boolean" },
    { key: "chips", label: "Floating chips", type: "stringlist" },
    {
      key: "stats",
      label: "Value row",
      type: "repeater",
      itemLabel: "Item",
      itemFields: [
        { key: "big", label: "Title", type: "text" },
        { key: "small", label: "Detail", type: "text" },
      ],
    },
  ],
  stats: [
    {
      key: "items",
      label: "Items",
      type: "repeater",
      itemFields: [
        { key: "big", label: "Title", type: "text" },
        { key: "small", label: "Detail", type: "text" },
      ],
    },
  ],
  heading: [
    { key: "text", label: "Text", type: "text" },
    { key: "level", label: "Level", type: "select", options: [{ value: "1", label: "H1" }, { value: "2", label: "H2" }, { value: "3", label: "H3" }] },
  ],
  text: [{ key: "html", label: "Text", type: "richtext" }],
  image: [
    { key: "src", label: "Image", type: "image" },
    { key: "alt", label: "Alt text", type: "text" },
    { key: "radius", label: "Corner radius", type: "number" },
  ],
  video: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    { key: "poster", label: "Poster image", type: "image" },
    { key: "src", label: "Video URL (mp4)", type: "text" },
    { key: "bleed", label: "Full width", type: "boolean" },
  ],
  imageText: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "body", label: "Body", type: "textarea" },
    { key: "image", label: "Image", type: "image" },
    { key: "imageSide", label: "Image side", type: "select", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }] },
    { key: "ctaLabel", label: "Button label", type: "text" },
    { key: "ctaHref", label: "Button link", type: "text" },
  ],
  features: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    {
      key: "items",
      label: "Features",
      type: "repeater",
      itemFields: [
        { key: "icon", label: "Icon", type: "select", options: ICON_OPTIONS },
        { key: "title", label: "Title", type: "text" },
        { key: "body", label: "Body", type: "text" },
      ],
    },
  ],
  steps: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    { key: "image", label: "Image", type: "image" },
    {
      key: "items",
      label: "Steps",
      type: "repeater",
      itemFields: [
        { key: "n", label: "Number", type: "text" },
        { key: "title", label: "Title", type: "text" },
        { key: "body", label: "Body", type: "text" },
      ],
    },
  ],
  bento: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    {
      key: "images",
      label: "Images",
      type: "repeater",
      itemFields: [
        { key: "src", label: "Image", type: "image" },
        { key: "caption", label: "Caption", type: "text" },
        { key: "tall", label: "Tall", type: "boolean" },
        { key: "wide", label: "Wide", type: "boolean" },
      ],
    },
  ],
  tabs: [
    { key: "heading", label: "Heading (HTML ok)", type: "textarea" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    {
      key: "tabs",
      label: "Tabs",
      type: "repeater",
      itemLabel: "Tab",
      itemFields: [
        { key: "label", label: "Tab label", type: "text" },
        { key: "bubble", label: "Colour", type: "select", options: [
          { value: "ivory", label: "Ivory" }, { value: "mint", label: "Mint" }, { value: "green", label: "Green" },
          { value: "sky", label: "Sky" }, { value: "peach", label: "Peach" }, { value: "char", label: "Charcoal" },
        ] },
        { key: "icon", label: "Icon", type: "select", options: ["record", "confirm", "watch", "decision", "prepare", "settle", "evidence", "chat"].map((v) => ({ value: v, label: v })) },
        { key: "title", label: "Title", type: "text" },
        { key: "body", label: "Body", type: "textarea" },
        { key: "points", label: "Bullet points", type: "stringlist" },
        { key: "buttonLabel", label: "Button label", type: "text" },
        { key: "buttonHref", label: "Button link", type: "text" },
        { key: "image", label: "Image", type: "image" },
        { key: "chip", label: "Floating chip", type: "text" },
      ],
    },
  ],
  simulator: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    { key: "points", label: "Bullet points", type: "stringlist" },
  ],
  cta: [
    { key: "heading", label: "Heading", type: "textarea" },
    { key: "subhead", label: "Subhead", type: "textarea" },
    { key: "buttonLabel", label: "Button label", type: "text" },
    { key: "buttonHref", label: "Button link", type: "text" },
  ],
  providerBand: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "body", label: "Body", type: "textarea" },
    { key: "buttonLabel", label: "Button label", type: "text" },
    { key: "buttonHref", label: "Button link", type: "text" },
    { key: "image", label: "Image", type: "image" },
  ],
  spacer: [{ key: "height", label: "Height (px)", type: "number" }],
};

/** A new block with sensible defaults, for the Add palette. */
export function newBlock(type: BlockType): Block {
  const id = newId();
  const common = { background: "canvas", paddingTop: 72, paddingBottom: 72 } as const;
  const defaults: Record<BlockType, Block> = {
    hero: { id, type, style: { background: "green" }, props: { overline: "Overline", heading: "Your headline here", subhead: "A short supporting line.", primaryLabel: "Chat with Kiataker", primaryHref: "#", phone: true, qr: true, qrText: "Scan to chat on WhatsApp", chips: ["Chip one", "Chip two"], stats: [{ big: "Point one", small: "detail" }] } },
    stats: { id, type, style: { background: "muted", paddingTop: 32, paddingBottom: 32 }, props: { items: [{ big: "Point", small: "detail" }, { big: "Point", small: "detail" }, { big: "Point", small: "detail" }] } },
    heading: { id, type, style: { ...common }, props: { text: "A heading", level: "2" } },
    text: { id, type, style: { ...common }, props: { html: "<p>Write your text here.</p>" } },
    image: { id, type, style: { ...common }, props: { src: "", alt: "", radius: 18 } },
    video: { id, type, style: { background: "canvas", paddingTop: 88, paddingBottom: 88 }, props: { heading: "See it in action", subhead: "", poster: "", src: "", bleed: true } },
    imageText: { id, type, style: { ...common }, props: { heading: "Heading", body: "Body text.", image: "", imageSide: "right", ctaLabel: "", ctaHref: "" } },
    features: { id, type, style: { ...common }, props: { heading: "Features", subhead: "", items: [{ icon: "record", title: "Feature", body: "Short detail." }] } },
    steps: { id, type, style: { ...common }, props: { heading: "How it works", subhead: "", image: "", items: [{ n: "01", title: "Step", body: "detail" }] } },
    bento: { id, type, style: { ...common }, props: { heading: "Gallery", subhead: "", images: [{ src: "", caption: "", tall: true }, { src: "", caption: "" }] } },
    tabs: { id, type, style: { background: "canvas", paddingTop: 100, paddingBottom: 100 }, props: { heading: "What we do", subhead: "", tabs: [{ label: "One", bubble: "ivory", icon: "record", title: "First feature", body: "Describe it.", points: ["Point one"], buttonLabel: "Learn more", buttonHref: "#", image: "", chip: "" }] } },
    simulator: { id, type, style: { background: "muted", paddingTop: 92, paddingBottom: 92 }, props: { heading: "Experience the technology", subhead: "Try it right here.", points: ["Understands plain language"] } },
    cta: { id, type, style: { background: "green", paddingTop: 92, paddingBottom: 92 }, props: { heading: "Ready to start?", subhead: "", buttonLabel: "Chat with Kiataker", buttonHref: "#" } },
    providerBand: { id, type, style: { ...common }, props: { heading: "Work with us", body: "Short description.", buttonLabel: "Learn more", buttonHref: "#", image: "" } },
    spacer: { id, type, props: { height: 48 } },
  };
  return defaults[type];
}

export const ADDABLE: BlockType[] = [
  "hero",
  "heading",
  "text",
  "image",
  "video",
  "imageText",
  "features",
  "steps",
  "bento",
  "tabs",
  "simulator",
  "stats",
  "cta",
  "providerBand",
  "spacer",
];
