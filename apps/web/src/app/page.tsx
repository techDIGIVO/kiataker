import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlockRenderer } from "@/cms/render";
import { StackFit } from "@/components/stack-fit";
import { DEFAULT_HOME } from "@/cms/default-home";
import type { PageContent } from "@/cms/types";

/**
 * Kiataker landing page (PRD §27). Rendered from the CMS: fetches the published "home"
 * page content and renders its blocks. Falls back to the default content when nothing is
 * published yet or the API is unreachable, so the site always renders.
 */

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

async function loadHome(): Promise<PageContent> {
  try {
    const res = await fetch(`${API_BASE}/v1/pages/home`, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as PageContent | null;
      if (json && Array.isArray(json.blocks) && json.blocks.length > 0) return json;
    }
  } catch {
    /* API unreachable: fall back to default content */
  }
  return DEFAULT_HOME;
}

export default async function LandingPage() {
  const content = await loadHome();
  return (
    <>
      <SiteHeader />
      <main>
        <BlockRenderer content={content} />
        <StackFit />
      </main>
      <SiteFooter />
    </>
  );
}
