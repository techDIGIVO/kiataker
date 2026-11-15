import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PropertyService } from "./property.service.js";
import { CurrentUser, type RequestUser } from "../../common/auth/current-user.decorator.js";

@Controller("properties")
export class PropertyController {
  constructor(private readonly properties: PropertyService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    return this.properties.create(user.sub, body);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.properties.listForLandlord(user.sub);
  }

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.properties.get(user.sub, id);
  }

  @Get(":id/timeline")
  timeline(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.properties.timeline(user.sub, id);
  }
}
