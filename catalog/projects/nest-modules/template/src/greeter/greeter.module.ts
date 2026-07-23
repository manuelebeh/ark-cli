import { Module } from "@nestjs/common";
import { GreeterController } from "./greeter.controller";
import { GreeterService } from "./greeter.service";

@Module({
  controllers: [GreeterController],
  providers: [GreeterService],
  exports: [GreeterService],
})
export class GreeterModule {}
