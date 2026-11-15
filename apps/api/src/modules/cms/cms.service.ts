import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { NotFound } from "../../common/errors/domain-errors.js";
import type { Prisma } from "@kiataker/db";

/**
 * Site CMS service. A page is an ordered tree of blocks stored as JSON. The admin builder
 * edits "draft"; "published" is what the public landing page renders (everything editable,
 * versioned, no code release needed, BP-18).
 */
@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPublished(slug: string): Promise<unknown | null> {
    const page = await this.prisma.sitePage.findUnique({ where: { slug } });
    return page?.published ?? null;
  }

  async getForAdmin(slug: string) {
    const page = await this.prisma.sitePage.findUnique({ where: { slug } });
    if (!page) return null;
    return {
      slug: page.slug,
      title: page.title,
      draft: page.draft,
      published: page.published,
      version: page.version,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  async saveDraft(slug: string, input: { title: string; draft: unknown }, actor: string) {
    const page = await this.prisma.sitePage.upsert({
      where: { slug },
      update: { title: input.title, draft: input.draft as Prisma.InputJsonValue, updatedBy: actor },
      create: { slug, title: input.title, draft: input.draft as Prisma.InputJsonValue, updatedBy: actor },
    });
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { actor, action: "cms.save_draft", objectRef: `page:${slug}` }),
    );
    return { slug: page.slug, version: page.version, savedAt: page.updatedAt.toISOString() };
  }

  async publish(slug: string, actor: string) {
    const page = await this.prisma.sitePage.findUnique({ where: { slug } });
    if (!page) throw new NotFound("Page not found");
    const updated = await this.prisma.sitePage.update({
      where: { slug },
      data: {
        published: page.draft as Prisma.InputJsonValue,
        publishedAt: new Date(),
        version: { increment: 1 },
        updatedBy: actor,
      },
    });
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, { actor, action: "cms.publish", objectRef: `page:${slug}` }),
    );
    return { slug, version: updated.version, publishedAt: updated.publishedAt?.toISOString() };
  }

  async listMedia() {
    const media = await this.prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return media.map((m) => ({ id: m.id, url: m.url, filename: m.filename, mimeType: m.mimeType }));
  }

  async recordMedia(data: { filename: string; url: string; mimeType: string; sizeBytes: number }, actor: string) {
    const asset = await this.prisma.mediaAsset.create({ data: { ...data, createdBy: actor } });
    return { id: asset.id, url: asset.url, filename: asset.filename };
  }
}
