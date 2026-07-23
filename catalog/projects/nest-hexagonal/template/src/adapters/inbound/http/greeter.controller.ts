import { Controller, Get, Query } from "@nestjs/common";
import { greet } from "../../../application/greet";
import { createConsoleNotifier } from "../../outbound/console.notifier";

@Controller("greet")
export class GreeterController {
  @Get()
  greet(@Query("name") name = "world"): { message: string } {
    return greet(name, createConsoleNotifier());
  }
}
