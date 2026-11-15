import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { DocumentsService } from "./documents.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { Public } from "../../common/auth/public.decorator.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Landlord surface: generate agreements, list documents, record a paper signature. */
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post("tenancy-agreement")
  generate(@CurrentUser() user: RequestUser, @Body() body: { tenancyId: string }) {
    return this.documents.generateTenancyAgreement(user.sub, body.tenancyId);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.documents.listForOwner(user.sub);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.documents.getForOwner(user.sub, id);
  }

  @Post(":id/paper-signature")
  paper(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { signerRole: string; signerName?: string; evidenceRef?: string }) {
    return this.documents.recordPaper(user.sub, id, body);
  }
}

/** Public surface: sign a document on a secure link. */
@Controller("sign")
export class DocumentSignController {
  constructor(private readonly documents: DocumentsService) {}

  @Public()
  @Get(":token")
  view(@Param("token") token: string) {
    return this.documents.signView(token);
  }

  @Public()
  @Post(":token")
  sign(@Param("token") token: string) {
    return this.documents.sign(token);
  }
}

/** Public surface: verify a document by reference and tamper-check a copy. */
@Controller("verify")
export class DocumentVerifyController {
  constructor(private readonly documents: DocumentsService) {}

  @Public()
  @Get(":reference")
  verify(@Param("reference") reference: string) {
    return this.documents.verify(reference);
  }

  /** Download the sealed document as a PDF (GJ-14). Public, by reference, like verification. */
  @Public()
  @Get(":reference/pdf")
  async pdf(@Param("reference") reference: string, @Res() res: Response) {
    const bytes = await this.documents.renderPdf(reference);
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `inline; filename="${reference}.pdf"`);
    res.setHeader("cache-control", "no-store");
    res.end(Buffer.from(bytes));
  }

  @Public()
  @Post(":reference")
  tamper(@Param("reference") reference: string, @Body() body: { body: string }) {
    return this.documents.verifyContent(reference, body?.body ?? "");
  }
}

/** Staff board of documents and their signatures. */
@UseGuards(StaffGuard)
@Controller("internal")
export class DocumentAdminController {
  constructor(private readonly documents: DocumentsService) {}

  @Get("board/documents")
  board() {
    return this.documents.board();
  }

  @Post("documents/:id/paper-signature")
  paper(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { signerRole: string; signerName?: string; evidenceRef?: string }) {
    return this.documents.staffRecordPaper(user.sub, id, body);
  }
}
