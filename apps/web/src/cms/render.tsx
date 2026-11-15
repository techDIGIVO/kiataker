import type { Block, PageContent } from "./types";
import { sectionStyle, isDark } from "./style";
import { IphoneMock } from "@/components/iphone-mock";
import { Reveal } from "@/components/reveal";
import { StoreBadge } from "@/components/store-badges";
import { WhatsAppSim } from "@/components/whatsapp-sim";
import { TabsShowcase } from "@/components/tabs-showcase";
import {
  IconRecord,
  IconConfirm,
  IconWatch,
  IconDecision,
  IconPrepare,
  IconSettle,
  IconEvidence,
  IconChat,
} from "@/components/icons";

const ICONS: Record<string, (p: { size?: number }) => React.ReactNode> = {
  record: IconRecord,
  confirm: IconConfirm,
  watch: IconWatch,
  decision: IconDecision,
  prepare: IconPrepare,
  settle: IconSettle,
  evidence: IconEvidence,
  chat: IconChat,
};

export function BlockRenderer({ content }: { content: PageContent }) {
  const heroes = content.blocks.filter((b) => b.type === "hero");
  const rest = content.blocks.filter((b) => b.type !== "hero");
  return (
    <>
      {heroes.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
      {/* Sticky scroll-stack: each section pins, the next scrolls up to replace it. */}
      <div className="stack">
        {rest.map((b) => (
          <div
            key={b.id}
            className={`stack-item${b.style?.bubble ? ` sec-bubble sec-bubble-${b.style.background ?? "muted"}` : ""}`}
          >
            <BlockView block={b} />
          </div>
        ))}
      </div>
    </>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} />;
    case "stats":
      return <StatsBlock block={block} />;
    case "heading":
      return <HeadingBlock block={block} />;
    case "text":
      return <TextBlock block={block} />;
    case "image":
      return <ImageBlock block={block} />;
    case "video":
      return <VideoBlock block={block} />;
    case "imageText":
      return <ImageTextBlock block={block} />;
    case "features":
      return <FeaturesBlock block={block} />;
    case "steps":
      return <StepsBlock block={block} />;
    case "bento":
      return <BentoBlock block={block} />;
    case "tabs":
      return <TabsBlock block={block} />;
    case "simulator":
      return <SimulatorBlock block={block} />;
    case "cta":
      return <CtaBlock block={block} />;
    case "providerBand":
      return <ProviderBlock block={block} />;
    case "spacer":
      return <div style={{ height: block.props.height ?? 48 }} />;
    default:
      return null;
  }
}

/* eslint-disable @next/next/no-img-element */

function HeroBlock({ block }: { block: Block }) {
  const p = block.props;
  const stats: { big: string; small: string }[] = p.stats ?? [];
  const qrSrc = p.qr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(p.primaryHref ?? "")}`
    : null;
  return (
    <section className="hero" style={{ background: sectionStyle(block.style).background, paddingTop: 0, paddingBottom: 0 }}>
      <div className="hero-orbs" aria-hidden="true">
        <div className="hero-ring r1" />
        <div className="hero-ring r2" />
        <div className="hero-ring r3" />
        <div className="hero-orb o1" />
        <div className="hero-orb o2" />
        <div className="hero-orb o3" />
      </div>
      <div className="container hero-grid">
        <div>
          {p.overline && <span className="overline on-dark">{p.overline}</span>}
          <h1 style={{ color: "#fff", fontSize: "clamp(42px, 6vw, 72px)", margin: "22px 0 16px", maxWidth: 600, fontWeight: 800, lineHeight: 1.02 }}>
            {p.heading}
          </h1>
          {p.subhead && <p style={{ color: "#E7F1EC", fontSize: 20, maxWidth: 470, marginBottom: 30 }}>{p.subhead}</p>}
          <div className="btn-row">
            {p.primaryLabel && (
              <a className="btn btn-light" href={p.primaryHref ?? "#"}>
                <IconChat size={20} />
                {p.primaryLabel}
              </a>
            )}
            {p.showStoreBadges && (
              <>
                <StoreBadge kind="apple" comingSoon />
                <StoreBadge kind="google" comingSoon />
              </>
            )}
          </div>
          {qrSrc && (
            <div className="qr-card" style={{ marginTop: 26 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Scan to chat with Kiataker on WhatsApp" />
              <span className="qr-text">{p.qrText ?? "Scan to chat with Kiataker on WhatsApp"}</span>
            </div>
          )}
        </div>
        <div className="hero-visual">
          {p.phone ? (
            <IphoneMock />
          ) : (
            <div className="hero-photo">{p.image ? <img src={p.image} alt={p.heading ?? ""} /> : null}</div>
          )}
          {(p.chips ?? (p.chip ? [p.chip] : [])).map((c: string, i: number) => (
            <div key={i} className="float-chip" style={i === 0 ? { right: -12, top: 18 } : { left: -12, bottom: 46 }}>
              <span className="dot" />
              {c}
            </div>
          ))}
          {!p.phone && p.card && (
            <div className="hero-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--k-font-mono)", fontSize: 12, color: "var(--k-text-muted)" }}>{p.card.reference}</span>
                <span className="pill pill-ok">{p.card.status}</span>
              </div>
              <div style={{ fontWeight: 700, fontFamily: "var(--k-font-heading)", fontSize: 16 }}>{p.card.address}</div>
              <div style={{ color: "var(--k-text-secondary)", fontSize: 13, marginBottom: 12 }}>{p.card.area}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid var(--k-border)", paddingTop: 10 }}>
                <span style={{ color: "var(--k-text-muted)" }}>Next action</span>
                <span style={{ fontWeight: 600, color: "var(--k-green-primary)" }}>{p.card.nextAction}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {stats.length > 0 && (
        <div className="container hero-stats">
          {stats.map((s, i) => (
            <div className="hero-stat" key={i}>
              <div className="hero-stat-big">{s.big}</div>
              <div className="hero-stat-small">{s.small}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHead({ heading, subhead, dark }: { heading?: string; subhead?: string; dark?: boolean }) {
  if (!heading && !subhead) return null;
  return (
    <div className="section-head">
      {heading && <h2 style={dark ? { color: "#fff" } : undefined}>{heading}</h2>}
      {subhead && <p style={dark ? { color: "#D9EAE1" } : undefined}>{subhead}</p>}
    </div>
  );
}

function StatsBlock({ block }: { block: Block }) {
  const items: { big: string; small: string }[] = block.props.items ?? [];
  const dark = isDark(block.style?.background);
  return (
    <section style={{ ...sectionStyle(block.style), paddingTop: block.style?.paddingTop ?? 32, paddingBottom: block.style?.paddingBottom ?? 32 }}>
      <div className="container trust-grid">
        {items.map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 22, color: dark ? "#fff" : "var(--k-green-primary)" }}>{s.big}</div>
            <div style={{ color: dark ? "#CFE6DA" : "var(--k-text-secondary)", fontSize: 14.5, marginTop: 2 }}>{s.small}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeadingBlock({ block }: { block: Block }) {
  const p = block.props;
  const Tag = (`h${p.level ?? 2}`) as "h1" | "h2" | "h3";
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container" style={{ maxWidth: block.style?.maxWidth ?? 760 }}>
        <Tag style={{ fontSize: p.level === 1 ? "clamp(34px,5vw,56px)" : "clamp(26px,3.6vw,40px)" }}>{p.text}</Tag>
      </div>
    </section>
  );
}

function TextBlock({ block }: { block: Block }) {
  const dark = isDark(block.style?.background);
  return (
    <section style={sectionStyle(block.style)}>
      <div
        className="container cms-richtext"
        style={{ maxWidth: block.style?.maxWidth ?? 760, fontSize: 17, color: dark ? "#E7F1EC" : "var(--k-text-secondary)" }}
        dangerouslySetInnerHTML={{ __html: block.props.html ?? "" }}
      />
    </section>
  );
}

function ImageBlock({ block }: { block: Block }) {
  const p = block.props;
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container" style={{ maxWidth: p.maxWidth ?? 980, textAlign: block.style?.align ?? "center" }}>
        {p.src && <img src={p.src} alt={p.alt ?? ""} style={{ width: "100%", borderRadius: p.radius ?? 18, display: "inline-block" }} />}
      </div>
    </section>
  );
}

function VideoBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  const frame = (
    <div className="video-frame zoom">
      {p.src ? (
        <video autoPlay muted loop playsInline poster={p.poster}>
          <source src={p.src} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="poster" src={p.poster} alt={p.heading ?? "Kiataker"} />
      )}
      {!p.src && (
        <div className="video-play">
          <span>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
      )}
    </div>
  );
  return (
    <section style={sectionStyle(block.style)}>
      {(p.heading || p.subhead) && (
        <div className="container">
          <div className="section-head" style={{ textAlign: "center", margin: "0 auto 40px" }}>
            {p.heading && <h2 style={dark ? { color: "#fff" } : undefined}>{p.heading}</h2>}
            {p.subhead && <p style={dark ? { color: "#D9EAE1" } : undefined}>{p.subhead}</p>}
          </div>
        </div>
      )}
      {p.bleed ? (
        <div className="video-bleed">{frame}</div>
      ) : (
        <div className="container" style={{ maxWidth: p.maxWidth ?? 1000 }}>
          {frame}
        </div>
      )}
    </section>
  );
}

function ImageTextBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  const imageRight = (p.imageSide ?? "right") === "right";
  const text = (
    <div>
      {p.heading && <h2 style={{ fontSize: "clamp(26px,3.4vw,38px)", marginBottom: 14, color: dark ? "#fff" : undefined }}>{p.heading}</h2>}
      {p.body && <p style={{ fontSize: 17, marginBottom: p.ctaLabel ? 24 : 0, color: dark ? "#D9EAE1" : undefined }}>{p.body}</p>}
      {p.ctaLabel && (
        <a className={dark ? "btn btn-light" : "btn btn-primary"} href={p.ctaHref ?? "#"}>
          {p.ctaLabel}
        </a>
      )}
    </div>
  );
  const image = (
    <div style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "4 / 3", background: "linear-gradient(135deg,#0b5138,#1c8a61)" }}>
      {p.image && <img src={p.image} alt={p.heading ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container two-grid">
        {imageRight ? (
          <>
            {text}
            {image}
          </>
        ) : (
          <>
            {image}
            {text}
          </>
        )}
      </div>
    </section>
  );
}

function FeaturesBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  const items: { icon?: string; title: string; body: string }[] = p.items ?? [];
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        <SectionHead heading={p.heading} subhead={p.subhead} dark={dark} />
        <div className="feature-grid">
          {items.map((it, i) => {
            const Icon = ICONS[it.icon ?? "record"] ?? IconRecord;
            return (
              <div key={i} className="card" style={{ padding: 26, height: "100%" }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: "var(--k-green-soft)", color: "var(--k-green-primary)", display: "grid", placeItems: "center", marginBottom: 16 }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{it.title}</h3>
                <p style={{ fontSize: 14.5 }}>{it.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepsBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  const items: { n: string; title: string; body: string }[] = p.items ?? [];
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        <SectionHead heading={p.heading} subhead={p.subhead} dark={dark} />
        <div className="two-grid">
          <div style={{ display: "grid", gap: 18 }}>
            {items.map((s, i) => (
              <div key={i} className="card" style={{ display: "flex", gap: 18, padding: 24 }}>
                <div style={{ fontFamily: "var(--k-font-heading)", fontWeight: 800, fontSize: 22, color: "var(--k-green-primary)", minWidth: 40 }}>{s.n}</div>
                <div>
                  <h3 style={{ fontSize: 19, marginBottom: 6 }}>{s.title}</h3>
                  <p style={{ fontSize: 15 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 22, overflow: "hidden", aspectRatio: "1 / 1", background: "linear-gradient(135deg,#0b5138,#1c8a61)" }}>
            {p.image && <img src={p.image} alt={p.heading ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function BentoBlock({ block }: { block: Block }) {
  const p = block.props;
  const images: { src: string; caption?: string; tall?: boolean; wide?: boolean }[] = p.images ?? [];
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        {(p.heading || p.subhead) && (
          <div className="two-grid" style={{ marginBottom: 40, alignItems: "end" }}>
            <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", maxWidth: 520 }}>{p.heading}</h2>
            <p style={{ fontSize: 17 }}>{p.subhead}</p>
          </div>
        )}
        <div className="bento">
          {images.map((im, i) => (
            <div key={i} className={`bento-item${im.tall ? " bento-tall" : ""}`} style={im.wide ? { gridColumn: "span 2" } : undefined}>
              {im.src && <img src={im.src} alt={im.caption ?? ""} />}
              {im.caption && <div className="bento-cap">{im.caption}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TabsBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
          {p.heading && <h2 style={{ fontSize: "clamp(30px,4.2vw,46px)", marginBottom: 14, color: dark ? "#fff" : undefined }} dangerouslySetInnerHTML={{ __html: p.heading }} />}
          {p.subhead && <p style={{ fontSize: 18.5, color: dark ? "#D9EAE1" : undefined }}>{p.subhead}</p>}
        </div>
        <TabsShowcase tabs={p.tabs ?? []} />
      </div>
    </section>
  );
}

function SimulatorBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        <div className="two-grid" style={{ alignItems: "center" }}>
          <div>
            <span className="overline" style={{ color: dark ? "#9FE0C1" : "var(--k-green-primary)" }}>Live WhatsApp demo</span>
            {p.heading && <h2 style={{ fontSize: "clamp(36px,5vw,56px)", lineHeight: 1.03, margin: "18px 0 18px", color: dark ? "#fff" : undefined }}>{p.heading}</h2>}
            {p.subhead && <p style={{ fontSize: 20, marginBottom: 26, color: dark ? "#D9EAE1" : "var(--k-text-secondary)", maxWidth: 460 }}>{p.subhead}</p>}
            {(p.points as string[] | undefined) && (
              <ul style={{ display: "grid", gap: 14, listStyle: "none", marginBottom: 30 }}>
                {(p.points as string[]).map((pt) => (
                  <li key={pt} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 18, fontWeight: 500, color: dark ? "#fff" : "var(--k-text-primary)" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: dark ? "rgba(255,255,255,.18)" : "var(--k-green-primary)", color: "#fff", display: "grid", placeItems: "center", flex: "none" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
            )}
            <a className={dark ? "btn btn-light" : "btn btn-primary"} href="/simulator">Open the full demo</a>
            <p style={{ fontSize: 14, marginTop: 16, color: dark ? "rgba(255,255,255,.7)" : "var(--k-text-muted)" }}>No download needed. Type or tap, right here.</p>
          </div>
          <div style={{ display: "grid", placeItems: "center" }}>
            <WhatsAppSim maxWidth={340} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBlock({ block }: { block: Block }) {
  const p = block.props;
  const dark = isDark(block.style?.background);
  return (
    <section style={{ ...sectionStyle(block.style), textAlign: "center" }}>
      <div className="container">
        <h2 style={{ fontSize: "clamp(30px,4.4vw,46px)", maxWidth: 700, margin: "0 auto 16px", color: dark ? "#fff" : undefined }}>{p.heading}</h2>
        {p.subhead && <p style={{ fontSize: 18.5, maxWidth: 520, margin: "0 auto 32px", color: dark ? "#D9EAE1" : undefined }}>{p.subhead}</p>}
        {p.buttonLabel && (
          <a className={dark ? "btn btn-light" : "btn btn-primary"} href={p.buttonHref ?? "#"}>
            {p.buttonLabel}
          </a>
        )}
      </div>
    </section>
  );
}

function ProviderBlock({ block }: { block: Block }) {
  const p = block.props;
  return (
    <section style={sectionStyle(block.style)}>
      <div className="container">
        <div className="provider-grid">
          <div style={{ padding: "52px 48px", background: "var(--k-ivory)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h2 style={{ fontSize: 32, marginBottom: 14 }}>{p.heading}</h2>
            {p.body && <p style={{ fontSize: 17, marginBottom: 28 }}>{p.body}</p>}
            {p.buttonLabel && (
              <a className="btn btn-primary" style={{ alignSelf: "flex-start" }} href={p.buttonHref ?? "#"}>
                {p.buttonLabel}
              </a>
            )}
          </div>
          <div style={{ minHeight: 340, background: "linear-gradient(135deg,#0b5138,#1c8a61)" }}>
            {p.image && <img src={p.image} alt={p.heading ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
        </div>
      </div>
    </section>
  );
}
