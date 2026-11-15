/** CMS block model for the Kiataker page builder. A page is an ordered list of blocks. */

export type BlockType =
  | "hero"
  | "stats"
  | "heading"
  | "text"
  | "image"
  | "video"
  | "imageText"
  | "features"
  | "steps"
  | "bento"
  | "tabs"
  | "simulator"
  | "cta"
  | "providerBand"
  | "spacer";

export interface BlockStyle {
  /** Keyword (canvas | muted | ivory | mint | sky | peach | green | char) or a hex colour. */
  background?: string;
  /** Render the section as a rounded coloured "bubble" on the page. */
  bubble?: boolean;
  textColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
  align?: "left" | "center";
  maxWidth?: number;
}

export interface Block {
  id: string;
  type: BlockType;
  // Props are block-specific; the builder and renderer agree on their shape per type.
  props: Record<string, any>;
  style?: BlockStyle;
}

export interface PageContent {
  blocks: Block[];
}

export function newId(): string {
  return "b_" + Math.random().toString(36).slice(2, 10);
}
