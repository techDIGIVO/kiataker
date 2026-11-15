import { Module } from "@nestjs/common";
import { DocumentsController, DocumentSignController, DocumentVerifyController, DocumentAdminController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  controllers: [DocumentsController, DocumentSignController, DocumentVerifyController, DocumentAdminController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
