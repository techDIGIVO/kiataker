import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { CryptoService } from "../../common/crypto/crypto.service.js";
import { OutboxService } from "../../common/outbox/outbox.service.js";
import { AuditService } from "../../common/audit/audit.service.js";
import { Forbidden, NotFound, Conflict } from "../../common/errors/domain-errors.js";
import { env } from "../../common/config/env.js";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
function naira(kobo: bigint): string {
  return `NGN ${(kobo / 100n).toLocaleString("en-NG")}`;
}

/**
 * Sealed documents (PRD §17, GJ-06, GJ-14). A document is generated, sealed with a content
 * hash, then signed by e-signature on a secure link or by paper upload. Anyone can verify it
 * publicly by reference, and a tamper check re-hashes a supplied copy against the seal.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  private async assertTenancyOwner(landlordId: string, tenancyId: string) {
    const tenancy = await this.prisma.tenancy.findUnique({
      where: { id: tenancyId },
      include: { property: true, terms: { orderBy: { version: "desc" }, take: 1 }, participants: { include: { tenantProfile: true } } },
    });
    if (!tenancy) throw new NotFound("Tenancy not found");
    const link = await this.prisma.propertyParticipant.findFirst({ where: { participantId: landlordId, propertyId: tenancy.propertyId } });
    if (!link) throw new Forbidden("This tenancy is not on your account");
    return tenancy;
  }

  /** Generate + seal a tenancy agreement and request landlord + tenant e-signatures. */
  async generateTenancyAgreement(landlordId: string, tenancyId: string) {
    const tenancy = await this.assertTenancyOwner(landlordId, tenancyId);
    const term = tenancy.terms[0];
    const tenantName = tenancy.participants[0]?.tenantProfile?.name ?? "the tenant";
    const landlord = await this.prisma.participant.findUnique({ where: { id: landlordId } });
    const landlordName = landlord?.displayName ?? "the landlord";
    const reference = `KT-DOC-${randomBytes(4).toString("hex").toUpperCase()}`;

    const body = [
      "TENANCY AGREEMENT",
      "",
      `This agreement is made between ${landlordName} (landlord) and ${tenantName} (tenant),`,
      `for the property at ${tenancy.property.addressRaw}.`,
      "",
      term ? `Rent: ${naira(term.rentKobo)} per ${term.frequency}.` : "Rent: as agreed.",
      tenancy.commencementDate ? `Commencement: ${tenancy.commencementDate.toDateString()}.` : "",
      tenancy.expiryDate ? `Expiry: ${tenancy.expiryDate.toDateString()}.` : "",
      "",
      "Issued through Kiataker. Verify this document by its reference at kiataker.ng/verify.",
      `Reference: ${reference}`,
    ].filter(Boolean).join("\n");

    const contentHash = sha256(body);

    const result = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.sealedDocument.create({
        data: { reference, type: "TENANCY_AGREEMENT", title: `Tenancy agreement for ${tenantName}`, body, contentHash, status: "SEALED", tenancyId, createdBy: landlordId, sealedAt: new Date() },
      });
      const landlordToken = randomBytes(24).toString("hex");
      const tenantToken = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await tx.documentSignature.create({ data: { documentId: doc.id, signerName: landlordName, signerRole: "LANDLORD", method: "ESIGN", tokenHash: this.crypto.valueHash(landlordToken), expiresAt } });
      await tx.documentSignature.create({ data: { documentId: doc.id, signerName: tenantName, signerRole: "TENANT", method: "ESIGN", tokenHash: this.crypto.valueHash(tenantToken), expiresAt } });
      await this.outbox.emit(tx, "document.sealed", doc.id, { reference, contentHash });
      await this.audit.record(tx, { actor: landlordId, action: "document.generate", objectRef: `document:${doc.id}`, after: { reference } });
      return { doc, landlordToken, tenantToken };
    });

    return {
      reference,
      documentId: result.doc.id,
      contentHash,
      verifyUrl: `${env.WEB_BASE_URL}/verify/${reference}`,
      landlordSignUrl: `${env.WEB_BASE_URL}/sign/${result.landlordToken}`,
      tenantSignUrl: `${env.WEB_BASE_URL}/sign/${result.tenantToken}`,
    };
  }

  /** The signer's view of the document on their secure link. */
  async signView(token: string) {
    const sig = await this.prisma.documentSignature.findFirst({ where: { tokenHash: this.crypto.valueHash(token) } });
    if (!sig) throw new NotFound("This link is not valid");
    const doc = await this.prisma.sealedDocument.findUnique({ where: { id: sig.documentId } });
    if (!doc) throw new NotFound("Document not found");
    return { reference: doc.reference, title: doc.title, body: doc.body, signerName: sig.signerName, signerRole: sig.signerRole, signed: sig.status === "SIGNED" };
  }

  /** Sign by e-signature on the secure link (BP-09). Seals the signer's name + the hash signed. */
  async sign(token: string) {
    const sig = await this.prisma.documentSignature.findFirst({ where: { tokenHash: this.crypto.valueHash(token) } });
    if (!sig) throw new NotFound("This link is not valid");
    if (sig.expiresAt && sig.expiresAt < new Date()) throw new Conflict("This link has expired");
    const doc = await this.prisma.sealedDocument.findUnique({ where: { id: sig.documentId } });
    if (!doc) throw new NotFound("Document not found");
    if (sig.status !== "SIGNED") {
      await this.prisma.$transaction(async (tx) => {
        await tx.documentSignature.update({ where: { id: sig.id }, data: { status: "SIGNED", signatureHash: doc.contentHash, signedAt: new Date() } });
        await this.outbox.emit(tx, "document.signed", doc.id, { role: sig.signerRole });
      });
      await this.maybeComplete(doc.id);
    }
    return { signed: true, role: sig.signerRole };
  }

  /** Record a paper (uploaded) signature for a signer (GJ-06, the paper route). */
  async recordPaper(landlordId: string, documentId: string, input: { signerRole: string; signerName?: string; evidenceRef?: string }) {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFound("Document not found");
    if (doc.tenancyId) await this.assertTenancyOwner(landlordId, doc.tenancyId);
    const existing = await this.prisma.documentSignature.findFirst({ where: { documentId, signerRole: input.signerRole } });
    if (existing) {
      await this.prisma.documentSignature.update({ where: { id: existing.id }, data: { status: "SIGNED", method: "PAPER", signatureHash: doc.contentHash, evidenceRef: input.evidenceRef, signedAt: new Date() } });
    } else {
      await this.prisma.documentSignature.create({ data: { documentId, signerName: input.signerName ?? input.signerRole, signerRole: input.signerRole, method: "PAPER", status: "SIGNED", signatureHash: doc.contentHash, evidenceRef: input.evidenceRef, signedAt: new Date() } });
    }
    await this.maybeComplete(documentId);
    return this.getForOwner(landlordId, documentId);
  }

  /** When every requested signature is signed, the document becomes SIGNED. */
  private async maybeComplete(documentId: string) {
    const sigs = await this.prisma.documentSignature.findMany({ where: { documentId } });
    if (sigs.length > 0 && sigs.every((s) => s.status === "SIGNED")) {
      await this.prisma.sealedDocument.update({ where: { id: documentId }, data: { status: "SIGNED", signedAt: new Date() } });
      await this.prisma.$transaction((tx) => this.outbox.emit(tx, "document.fully_signed", documentId, {}));
    }
  }

  /** Public verification by reference: authentic metadata + the sealed hash + signatures. */
  async verify(reference: string) {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { reference }, include: { signatures: true } });
    if (!doc) throw new NotFound("No document with that reference");
    return {
      reference: doc.reference,
      type: doc.type,
      title: doc.title,
      status: doc.status,
      contentHash: doc.contentHash,
      sealedAt: doc.sealedAt?.toISOString() ?? null,
      signedAt: doc.signedAt?.toISOString() ?? null,
      valid: doc.status === "SEALED" || doc.status === "SIGNED",
      signatures: doc.signatures.map((s) => ({ role: s.signerRole, name: s.signerName, method: s.method, status: s.status, signedAt: s.signedAt?.toISOString() ?? null })),
    };
  }

  /**
   * Render a sealed document to a PDF (GJ-14). The seal (content hash), status, reference and
   * signatures travel on the page, and a footer points to the public verifier, so a downloaded or
   * printed copy stays checkable. Public: anyone with the reference can fetch it, like the verifier.
   */
  async renderPdf(reference: string): Promise<Uint8Array> {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { reference }, include: { signatures: true } });
    if (!doc) throw new NotFound("No document with that reference");

    const pdf = await PDFDocument.create();
    pdf.setTitle(doc.title);
    pdf.setProducer("Kiataker");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const SIZE: [number, number] = [595.28, 841.89]; // A4
    const margin = 56;
    const width = SIZE[0] - margin * 2;
    const grey = rgb(0.4, 0.4, 0.4);
    const green = rgb(0.043, 0.318, 0.22);

    let page = pdf.addPage(SIZE);
    let y = SIZE[1] - margin;

    const wrap = (text: string, size: number, f = font): string[] => {
      const out: string[] = [];
      for (const raw of text.split("\n")) {
        if (raw === "") { out.push(""); continue; }
        let line = "";
        for (const word of raw.split(" ")) {
          const next = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = word; } else line = next;
        }
        if (line) out.push(line);
      }
      return out;
    };
    const draw = (text: string, size: number, f = font, color = rgb(0.1, 0.1, 0.1)) => {
      for (const line of wrap(text, size, f)) {
        if (y < margin + 40) { page = pdf.addPage(SIZE); y = SIZE[1] - margin; }
        page.drawText(line, { x: margin, y, size, font: f, color });
        y -= size * 1.5;
      }
    };

    draw("KIATAKER", 10, bold, green);
    y -= 6;
    draw(doc.title, 18, bold);
    y -= 8;
    draw(doc.body, 11);
    y -= 16;
    draw(`Status: ${doc.status}`, 10, bold, grey);
    draw(`Reference: ${doc.reference}`, 10, font, grey);
    if (doc.contentHash) draw(`Content hash (SHA-256): ${doc.contentHash}`, 9, font, grey);
    if (doc.signatures.length) {
      y -= 8;
      draw("Signatures", 11, bold);
      for (const s of doc.signatures) draw(`- ${s.signerRole}: ${s.signerName} - ${s.status}${s.method ? ` (${s.method})` : ""}`, 10, font, grey);
    }
    y -= 16;
    draw("Issued through Kiataker. Verify this document by its reference at kiataker.ng/verify.", 9, font, grey);

    return pdf.save();
  }

  /** Tamper check: re-hash a supplied copy and compare it to the seal. */
  async verifyContent(reference: string, body: string) {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { reference } });
    if (!doc) throw new NotFound("No document with that reference");
    return { reference, matches: sha256(body) === doc.contentHash, sealedHash: doc.contentHash };
  }

  /** Staff record a paper signature on the landlord's behalf (concierge). */
  async staffRecordPaper(staffId: string, documentId: string, input: { signerRole: string; signerName?: string; evidenceRef?: string }) {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFound("Document not found");
    let owner = staffId;
    if (doc.tenancyId) {
      const tenancy = await this.prisma.tenancy.findUnique({ where: { id: doc.tenancyId } });
      const link = tenancy ? await this.prisma.propertyParticipant.findFirst({ where: { propertyId: tenancy.propertyId, basis: "PB-01" } }) : null;
      if (link) owner = link.participantId;
    }
    const result = await this.recordPaper(owner, documentId, input);
    await this.prisma.$transaction((tx) => this.audit.record(tx, { actor: staffId, action: "admin.document.record_paper", objectRef: `document:${documentId}`, reason: "staff action", after: { signerRole: input.signerRole } }));
    return result;
  }

  async getForOwner(landlordId: string, documentId: string) {
    const doc = await this.prisma.sealedDocument.findUnique({ where: { id: documentId }, include: { signatures: true } });
    if (!doc) throw new NotFound("Document not found");
    if (doc.tenancyId) await this.assertTenancyOwner(landlordId, doc.tenancyId);
    return this.toDto(doc);
  }

  async listForOwner(landlordId: string) {
    const links = await this.prisma.propertyParticipant.findMany({ where: { participantId: landlordId } });
    const propertyIds = links.map((l) => l.propertyId);
    if (propertyIds.length === 0) return [];
    const tenancies = await this.prisma.tenancy.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } });
    const tenancyIds = tenancies.map((t) => t.id);
    const docs = await this.prisma.sealedDocument.findMany({ where: { tenancyId: { in: tenancyIds } }, orderBy: { createdAt: "desc" }, take: 50, include: { signatures: true } });
    return docs.map((d) => this.toDto(d));
  }

  async board() {
    const docs = await this.prisma.sealedDocument.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { signatures: true } });
    return docs.map((d) => this.toDto(d));
  }

  private toDto(d: { id: string; reference: string; type: string; title: string; status: string; contentHash: string | null; createdAt: Date; signatures: { signerRole: string; status: string; method: string }[] }) {
    return {
      id: d.id,
      reference: d.reference,
      type: d.type,
      title: d.title,
      status: d.status,
      contentHash: d.contentHash,
      signatures: d.signatures.map((s) => ({ role: s.signerRole, status: s.status, method: s.method })),
      createdAt: d.createdAt.toISOString(),
    };
  }
}
