import { Injectable } from "@nestjs/common";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { CmsService } from "./cms.service.js";
import { env } from "../../common/config/env.js";
import { Conflict } from "../../common/errors/domain-errors.js";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? resolve(process.cwd(), "apps/api/uploads"));

/** Image upload for the CMS. Decodes a base64 payload to disk and records a MediaAsset. */
@Injectable()
export class UploadsService {
  constructor(private readonly cms: CmsService) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  async upload(body: { filename?: string; mimeType: string; dataBase64: string }, actor: string) {
    if (!ALLOWED.has(body.mimeType)) throw new Conflict("Only image files are allowed");
    const buffer = Buffer.from(body.dataBase64, "base64");
    if (buffer.length === 0) throw new Conflict("Empty file");
    if (buffer.length > MAX_BYTES) throw new Conflict("File is larger than 8 MB");

    const ext = EXT[body.mimeType] ?? extname(body.filename ?? "") ?? ".bin";
    const name = `${randomUUID()}${ext}`;
    writeFileSync(resolve(UPLOADS_DIR, name), buffer);
    const url = `${env.API_BASE_URL}/uploads/${name}`;

    return this.cms.recordMedia(
      { filename: body.filename ?? name, url, mimeType: body.mimeType, sizeBytes: buffer.length },
      actor,
    );
  }
}
