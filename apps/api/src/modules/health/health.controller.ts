import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { Public } from "../../common/auth/public.decorator.js";

/** Health check (§45). /v1/health returns the build commit within 60 seconds of deploy. */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    let db = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return {
      status: db === "up" ? "ok" : "degraded",
      service: "kiataker-api",
      commit: process.env.GIT_COMMIT ?? "dev",
      db,
      time: new Date().toISOString(),
    };
  }
}
