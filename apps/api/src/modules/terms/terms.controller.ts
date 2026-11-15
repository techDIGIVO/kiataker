import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { Public } from "../../common/auth/public.decorator.js";

@Controller("terms")
export class TermsController {
  constructor(private readonly prisma: PrismaService) {}

  /** The current Terms, Mandate and Privacy Notice versions to accept in one step. */
  @Public()
  @Get("current")
  async current() {
    const docs = await this.prisma.termsDocument.findMany({
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    return docs.flatMap((d) =>
      d.versions.map((v) => ({
        kind: d.kind,
        termsVersionId: v.id,
        version: v.version,
        contentHash: v.contentHash,
        effectiveFrom: v.effectiveFrom.toISOString(),
      })),
    );
  }
}
