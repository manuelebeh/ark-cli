import { Module } from "@nestjs/common";
import { GreeterModule } from "./adapters/inbound/http/greeter.module";

@Module({
  imports: [GreeterModule],
})
export class AppModule {}
