import { Body, Controller, Get, NotFoundException, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AdminService } from "./admin.service.js";
import { StaffGuard } from "./staff.guard.js";
import { ControlGovernanceService } from "../../common/controls/control-governance.service.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

/** Admin surface (admin.kiataker.ng). Staff only, under least privilege. */
@UseGuards(StaffGuard)
@Controller("internal")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly governance: ControlGovernanceService,
  ) {}

  /** Change a control. Low and medium apply at once; a high-risk change is held for CEO sign-off (GJ-18). */
  @Put("controls/:key")
  setControl(@CurrentUser() user: RequestUser, @Param("key") key: string, @Body() body: { enabled: boolean; reason?: string }) {
    return this.governance.requestChange(key, Boolean(body.enabled), user.sub, body.reason);
  }

  // Control-change sign-off (GJ-18). A high-risk change waits here until the CEO decides.
  @Get("control-changes")
  controlChanges() {
    return this.governance.board();
  }

  @Get("control-changes/pending")
  controlChangesPending() {
    return this.governance.pending();
  }

  @Post("control-changes/:id/approve")
  approveControlChange(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { reason?: string }) {
    return this.governance.approve(id, user.sub, body.reason);
  }

  @Post("control-changes/:id/reject")
  rejectControlChange(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() body: { reason: string }) {
    return this.governance.reject(id, user.sub, body.reason);
  }

  @Post("control-changes/:id/cancel")
  cancelControlChange(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.governance.cancel(id, user.sub);
  }

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("landlords")
  landlords() {
    return this.admin.landlords();
  }

  @Get("centres/operations/queue")
  operationsQueue() {
    return this.admin.operationsQueue();
  }

  @Get("controls")
  controls() {
    return this.admin.controls();
  }

  // Command Centre boards (operational surfaces for each engine).
  @Get("board/issues")
  issuesBoard() {
    return this.admin.issuesBoard();
  }

  @Get("board/issues/:id")
  async issueDetail(@Param("id") id: string) {
    const detail = await this.admin.issueDetail(id);
    if (!detail) throw new NotFoundException("Issue not found");
    return detail;
  }

  @Get("board/notices")
  noticesBoard() {
    return this.admin.noticesBoard();
  }

  @Get("board/arrears")
  arrearsBoard() {
    return this.admin.arrearsBoard();
  }

  @Get("board/reconciliations")
  reconciliationQueue() {
    return this.admin.reconciliationQueue();
  }
}
