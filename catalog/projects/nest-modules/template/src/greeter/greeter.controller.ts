import { Controller, Get, Query } from "@nestjs/common";
import { GreeterService } from "./greeter.service";

@Controller("greet")
export class GreeterController {
  constructor(private readonly greeter: GreeterService) {}

  @Get()
  greet(@Query("name") name = "world"): { message: string } {
    return this.greeter.greet(name);
  }
}
