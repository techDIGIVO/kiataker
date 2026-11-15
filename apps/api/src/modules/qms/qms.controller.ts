import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { QmsService } from "./qms.service.js";
import { StaffGuard } from "../admin/staff.guard.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** QMS workbench (staff): review Property Files and set their QC status (P4). */
@UseGuards(StaffGuard)
@Controller("internal")
export class QmsAdminController {
  constructor(private readonly qms: QmsService) {}

  @Get("board/qms")
  board() {
    return this.qms.board();
  }

  @Put("qms/:propertyId")
  setStatus(@CurrentUser() user: RequestUser, @Param("propertyId") propertyId: string, @Body() body: { qcStatus: string; note?: string }) {
    return this.qms.setStatus(user.sub, propertyId, body.qcStatus, body.note);
  }
}
