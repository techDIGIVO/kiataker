import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ChannelService } from "./channel.service.js";
import { StaffGuard } from "../admin/staff.guard.js";

/** Admin control of the WhatsApp channel: message templates, quiet hours, notification queue. */
@UseGuards(StaffGuard)
@Controller("internal/whatsapp")
export class ChannelAdminController {
  constructor(private readonly channel: ChannelService) {}

  @Get("templates")
  templates() {
    return this.channel.listTemplates();
  }

  @Post("templates")
  createTemplate(@Body() body: { name: string; category?: string; language?: string; body: string }) {
    return this.channel.createTemplate(body);
  }

  @Post("templates/:id/submit")
  submitTemplate(@Param("id") id: string) {
    return this.channel.submitTemplate(id);
  }

  @Put("templates/:id/status")
  setStatus(@Param("id") id: string, @Body() body: { status: "APPROVED" | "REJECTED"; rejectionReason?: string }) {
    return this.channel.setTemplateStatus(id, body.status, body.rejectionReason);
  }

  @Get("quiet-hours")
  async quietHours() {
    return this.channel.getQuietHours();
  }

  @Put("quiet-hours")
  setQuietHours(@Body() body: { startHour: number; endHour: number }) {
    // actor comes from the staff token; a fixed label keeps the audit readable here.
    return this.channel.setQuietHours(Number(body.startHour), Number(body.endHour), "staff");
  }

  @Get("notifications")
  notifications() {
    return this.channel.listNotifications();
  }

  @Post("notifications")
  enqueue(@Body() body: { participantId: string; templateName: string; params?: string[] }) {
    return this.channel.enqueue(body.participantId, body.templateName, body.params ?? []);
  }

  @Post("notifications/process")
  process() {
    return this.channel.processDue();
  }
}
