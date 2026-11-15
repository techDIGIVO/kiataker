import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { env } from "../../common/config/env.js";
import { buildClassifySystemPrompt, parseIntent, callProvider } from "./llm.util.js";

export type Intent =
  | "greeting"
  | "menu"
  | "add_property"
  | "record_tenancy"
  | "send_notice"
  | "new_tenancy"
  | "my_originations"
  | "draft_agreement"
  | "end_tenancy"
  | "my_closeouts"
  | "condition_check"
  | "renewals"
  | "scope"
  | "my_data"
  | "buildings"
  | "report_issue"
  | "my_issues"
  | "collect_rent"
  | "my_actions"
  | "my_properties"
  | "help"
  | "human"
  | "affirm"
  | "deny"
  | "unknown";

/** LLM providers the WhatsApp agent can run on. Swappable from the admin, no redeploy. */
export const AI_PROVIDERS = [
  { id: "fake", label: "Local (deterministic, no LLM)", models: ["rules"] },
  { id: "anthropic", label: "Anthropic Claude", models: ["claude-opus-4-8", "claude-sonnet-5-5", "claude-haiku-5-5"] },
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
  { id: "google", label: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash"] },
] as const;

export interface AiConfig {
  provider: string;
  model: string;
  temperature: number;
  systemStyle: string;
}

const DEFAULT_CONFIG: AiConfig = {
  provider: env.AI_ADAPTER === "hosted" ? "anthropic" : "fake",
  model: "claude-sonnet-5-5",
  temperature: 0.3,
  systemStyle: "Warm, clear and human. Conversational, never robotic. Understands and routes; never decides for the landlord.",
};

/**
 * AI understanding adapter (PRD §40, SECU-13, BP-11). The AI is a constrained tool: it
 * classifies a plain-language message into an intent. It NEVER decides permissions,
 * approvals or professional judgment; message content is data, never an instruction. The
 * provider and model are an admin setting (ai.config), so the LLM can be switched from the
 * Command Centre without a code release. Locally the deterministic fake stands in.
 */
export interface ClassifyDiagnostics {
  intent: Intent;
  path: "llm" | "fallback";
  provider: string;
  model: string;
  ms: number;
  error?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger("AiService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The API key for a provider, from the stored integration keys (never returned to clients). */
  private async getKey(provider: string): Promise<string | undefined> {
    const row = await this.prisma.setting.findUnique({ where: { key: "ai.keys" } });
    return (row?.value as Record<string, string> | undefined)?.[provider];
  }

  /**
   * Understand a free-text message into an intent (BP-11). When a hosted provider and key are
   * configured, a strictly-constrained LLM classifies it; otherwise, or on any error/timeout, the
   * deterministic rules do. The LLM only ever returns one of a fixed label set (validated here),
   * and the engine acts on the label with its own guards, so the AI never decides anything.
   */
  async classifyMessage(text: string): Promise<Intent> {
    return (await this.classifyWithDiagnostics(text)).intent;
  }

  async classifyWithDiagnostics(text: string): Promise<ClassifyDiagnostics> {
    const cfg = await this.getConfig();
    const deterministic = this.classify(text);
    if (cfg.provider === "fake") {
      return { intent: deterministic, path: "fallback", provider: "fake", model: "rules", ms: 0 };
    }
    const key = await this.getKey(cfg.provider);
    if (!key) {
      return { intent: deterministic, path: "fallback", provider: cfg.provider, model: cfg.model, ms: 0, error: "no API key set" };
    }
    try {
      const result = await callProvider(cfg.provider, cfg.model, key, buildClassifySystemPrompt(), text, { temperature: 0 });
      const label = parseIntent(result.text);
      // A confident, valid label wins; "unknown" or an unparseable reply falls back to the rules.
      if (label && label !== "unknown") return { intent: label as Intent, path: "llm", provider: cfg.provider, model: cfg.model, ms: result.ms };
      return { intent: deterministic, path: "fallback", provider: cfg.provider, model: cfg.model, ms: result.ms };
    } catch (e) {
      this.logger.warn(`LLM classify failed, using deterministic rules: ${(e as Error).message}`);
      return { intent: deterministic, path: "fallback", provider: cfg.provider, model: cfg.model, ms: 0, error: (e as Error).message };
    }
  }

  async getConfig(): Promise<AiConfig> {
    const row = await this.prisma.setting.findUnique({ where: { key: "ai.config" } });
    if (!row) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(row.value as Partial<AiConfig>) };
  }

  async setConfig(input: Partial<AiConfig>, actor: string): Promise<AiConfig> {
    const current = await this.getConfig();
    const next = { ...current, ...input };
    await this.prisma.setting.upsert({
      where: { key: "ai.config" },
      update: { value: next as object, author: actor },
      create: { key: "ai.config", value: next as object, author: actor },
    });
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { actor, action: "ai.config_changed", objectRef: "setting:ai.config", after: next }),
    );
    return next;
  }

  /** Deterministic rule-based intent classifier. Used directly when the provider is "fake", and
   *  as the always-available fallback for the LLM path (classifyMessage) on no-key/error/timeout. */
  classify(text: string): Intent {
    const t = text.trim().toLowerCase();
    if (!t) return "unknown";
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|start)\b/.test(t)) return "greeting";
    if (/\b(menu|options|what can you do)\b/.test(t)) return "menu";
    if (t === "set up a building" || /\bbuilding\b/.test(t) || /\bmixed[- ]?use\b/.test(t) || /\bblock of flats\b/.test(t) || /\bflats? and shops?\b/.test(t) || /\b(multiple|several) units\b/.test(t)) return "buildings";
    if (/\b(add|new|register|onboard).*(property|house|flat|apartment|shop)\b/.test(t) || t === "add a property") return "add_property";
    if (t === "my originations" || t === "my new tenancies" || /\b(pending|in progress) tenanc/.test(t)) return "my_originations";
    if (t === "scope of management" || t === "scope" || /\bscope\b/.test(t) || /\bwhat.*(you|kiataker).*(manage|handle)\b/.test(t)) return "scope";
    if (t === "my data" || t === "my data rights" || /\bdata rights?\b/.test(t) || /\b(erase|delete|download|export|copy of|access)\b.*\b(my )?(data|information|details)\b/.test(t) || /\b(ndpa|gdpr|privacy rights?)\b/.test(t)) return "my_data";
    if (t === "renewals" || /\b(renew\w*|expir\w*|notice to quit|possession)\b/.test(t)) return "renewals";
    if (t === "condition check" || /\b(condition check|handover|inventory|inspection|move[- ]?in condition)\b/.test(t)) return "condition_check";
    if (t === "my closeouts" || t === "my close-outs" || /\bclose[- ]?outs?\b/.test(t)) return "my_closeouts";
    if (t === "end a tenancy" || /\b(end|close out|terminate|move[- ]?out|vacat\w*)\b.*\b(tenancy|tenant|lease)\b/.test(t) || /\btenant (is )?(moving|moved) out\b/.test(t)) return "end_tenancy";
    if (t === "draft an agreement" || /\b(draft|prepare|generate|create|sign).*(agreement|contract)\b/.test(t) || /\btenancy agreement\b/.test(t)) return "draft_agreement";
    if (t === "new tenancy" || /\b(new|set up|create|start|originate).*(tenancy|lease)\b/.test(t) || /\blet .*property\b/.test(t)) return "new_tenancy";
    if (/\b(record|add).*(tenant|tenancy)\b/.test(t) || t === "record a tenancy") return "record_tenancy";
    if (/\b(send|issue|serve).*(notice)\b/.test(t) || /\bnotice\b/.test(t) || t === "send a notice" || /rent review|recover possession|quit/.test(t)) return "send_notice";
    if (t === "my issues" || t === "my repairs" || /\b(my )?(issues|repairs|quotes?|work)\b/.test(t)) return "my_issues";
    if (t === "report a problem" || /\b(report|log|raise)\b.*\b(issue|problem|fault|repair|leak)\b/.test(t) || /\b(leak|leaking|broken|faulty|not working|plumbing|electrical)\b/.test(t)) return "report_issue";
    if (t === "collect rent" || /\b(collect|request|charge)\b.*\b(rent|payment)\b/.test(t) || /\bpay (my )?rent\b/.test(t) || /\bpayment link\b/.test(t)) return "collect_rent";
    if (/\b(decision|action|act now|what needs|to do|todo)\b/.test(t) || t === "what needs my decision") return "my_actions";
    if (/\b(my )?propert(y|ies)\b/.test(t) || t === "my properties") return "my_properties";
    if (/\b(help|support)\b/.test(t)) return "help";
    if (/\b(agent|human|person|talk to)\b/.test(t)) return "human";
    if (/^(yes|yeah|yep|correct|confirm|ok|okay|sure|y)$/.test(t)) return "affirm";
    if (/^(no|nope|cancel|stop|n)$/.test(t)) return "deny";
    return "unknown";
  }

  extractBuildingUse(text: string): "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | null {
    const t = text.toLowerCase();
    if (/mixed/.test(t)) return "MIXED_USE";
    if (/commercial|shop|office|warehouse/.test(t)) return "COMMERCIAL";
    if (/residential|home|flat|apartment|house|duplex|bungalow/.test(t)) return "RESIDENTIAL";
    return null;
  }
}
