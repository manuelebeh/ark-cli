import { Module } from "@nestjs/common";
import { GreeterController } from "./greeter.controller";

@Module({
  controllers: [GreeterController],
})
export class GreeterModule {}
