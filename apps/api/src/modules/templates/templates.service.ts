import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { NoticesService } from "../notices/notices.service.js";
import { NotFound, Conflict } from "../../common/errors/domain-errors.js";

interface VersionInput {
  name: string;
  body: string;
  legalBasis?: string;
  fields?: string[];
}

/** Fill {placeholders} in a template body with values; unknown placeholders are left as-is. */
export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] ?? "" : match));
}

/** Pull the {placeholders} a body actually uses, in order of first appearance. */
export function extractFields(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{(\w+)\}/g)) found.add(m[1] as string);
  return [...found];
}

/**
 * Template studio (PRD §17, P0-09). Staff author notice and agreement templates (NT/AG codes) as
 * versioned, counsel-approved documents. A new version starts unapproved; the notice engine only
 * ever instructs a counsel-approved version (NoticesService enforces that), so the studio is the
 * controlled authoring surface in front of that gate. Append-only: versions are added, not edited.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notices: NoticesService,
  ) {}

  private name(variables: unknown, code: string): string {
    return (variables as { name?: string })?.name ?? code;
  }
  private fields(variables: unknown): string[] {
    return (variables as { fields?: string[] })?.fields ?? [];
  }

  /** Every template with its full version history (newest first). */
  async board() {
    await this.notices.ensureTemplates();
    const templates = await this.prisma.template.findMany({ include: { versions: { orderBy: { version: "desc" } } }, orderBy: { code: "asc" } });
    return templates.map((t) => ({
      id: t.id,
      code: t.code,
      name: this.name(t.versions[0]?.variables, t.code),
      versionCount: t.versions.length,
      hasApproved: t.versions.some((v) => v.counselApprovedAt),
      versions: t.versions.map((v) => ({
        id: v.id,
        version: v.version,
        name: this.name(v.variables, t.code),
        legalBasis: v.legalBasis,
        fields: this.fields(v.variables),
        body: v.body,
        approved: Boolean(v.counselApprovedAt),
        approvedBy: v.counselApprovedBy,
        approvedAt: v.counselApprovedAt?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    }));
  }

  /** Create a brand-new template (unique code) with its first, unapproved version. */
  async createTemplate(staffId: string, input: { code: string; name: string; body: string; legalBasis?: string; fields?: string[] }) {
    if (!input.code?.trim()) throw new Conflict("A template needs a code");
    if (!input.name?.trim() || !input.body?.trim()) throw new Conflict("A template needs a name and a body");
    const existing = await this.prisma.template.findUnique({ where: { code: input.code.trim() } });
    if (existing) throw new Conflict("A template with that code already exists");
    const tpl = await this.prisma.$transaction(async (tx) => {
      const t = await tx.template.create({ data: { code: input.code.trim() } });
      await tx.templateVersion.create({ data: { templateId: t.id, version: 1, body: input.body, variables: { name: input.name.trim(), fields: input.fields ?? extractFields(input.body) }, legalBasis: input.legalBasis ?? null } });
      await this.audit.record(tx, { actor: staffId, action: "template.create", objectRef: `template:${t.id}`, after: { code: input.code.trim() } });
      return t;
    });
    return this.detail(tpl.id);
  }

  /** Add a new version to an existing template. Starts unapproved. */
  async addVersion(staffId: string, templateId: string, input: VersionInput) {
    const tpl = await this.prisma.template.findUnique({ where: { id: templateId }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
    if (!tpl) throw new NotFound("Template not found");
    if (!input.name?.trim() || !input.body?.trim()) throw new Conflict("A version needs a name and a body");
    const nextVersion = (tpl.versions[0]?.version ?? 0) + 1;
    await this.prisma.$transaction(async (tx) => {
      await tx.templateVersion.create({ data: { templateId, version: nextVersion, body: input.body, variables: { name: input.name.trim(), fields: input.fields ?? extractFields(input.body) }, legalBasis: input.legalBasis ?? null } });
      await this.audit.record(tx, { actor: staffId, action: "template.add_version", objectRef: `template:${templateId}`, after: { version: nextVersion } });
    });
    return this.detail(templateId);
  }

  /** Record counsel approval on a version. Only then can the notice engine use it. */
  async approve(staffId: string, versionId: string, counselName?: string) {
    const version = await this.prisma.templateVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFound("Template version not found");
    if (version.counselApprovedAt) throw new Conflict("This version is already approved");
    await this.prisma.$transaction(async (tx) => {
      await tx.templateVersion.update({ where: { id: versionId }, data: { counselApprovedBy: counselName?.trim() || staffId, counselApprovedAt: new Date() } });
      await this.audit.record(tx, { actor: staffId, action: "template.approve", objectRef: `template-version:${versionId}`, reason: counselName?.trim() });
    });
    return this.detail(version.templateId);
  }

  /** Preview a version rendered with sample values (same substitution the notice engine uses). */
  async preview(versionId: string, values: Record<string, string> = {}) {
    const version = await this.prisma.templateVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFound("Template version not found");
    const fields = this.fields(version.variables);
    const filled: Record<string, string> = {};
    for (const f of fields) filled[f] = values[f] ?? `[${f}]`;
    return { versionId, fields, rendered: renderTemplate(version.body, filled) };
  }

  async detail(templateId: string) {
    const all = await this.board();
    const one = all.find((t) => t.id === templateId);
    if (!one) throw new NotFound("Template not found");
    return one;
  }
}
