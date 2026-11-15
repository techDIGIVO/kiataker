import { Module } from "@nestjs/common";
import { SecureTasksController } from "./secure-tasks.controller.js";
import { SecureTasksService } from "./secure-tasks.service.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { NoticesModule } from "../notices/notices.module.js";

@Module({
  imports: [TenancyModule, NoticesModule],
  controllers: [SecureTasksController],
  providers: [SecureTasksService],
})
export class SecureTasksModule {}
