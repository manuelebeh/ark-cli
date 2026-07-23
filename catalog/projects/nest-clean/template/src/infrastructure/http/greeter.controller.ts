import { Controller, Get, Query } from "@nestjs/common";
import { greet } from "../../application/greet";

@Controller("greet")
export class GreeterController {
  @Get()
  greet(@Query("name") name = "world"): { message: string } {
    return greet(name, {
      save() {
        /* no-op persistence for scaffold */
      },
    });
  }
}
