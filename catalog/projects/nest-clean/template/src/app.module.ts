import { Module } from "@nestjs/common";
import { GreeterModule } from "./infrastructure/http/greeter.module";

@Module({
  imports: [GreeterModule],
})
export class AppModule {}
