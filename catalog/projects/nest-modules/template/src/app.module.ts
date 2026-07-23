import { Module } from "@nestjs/common";
import { GreeterModule } from "./greeter/greeter.module";

@Module({
  imports: [GreeterModule],
})
export class AppModule {}
