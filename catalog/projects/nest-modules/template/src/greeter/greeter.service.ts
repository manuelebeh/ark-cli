import { Injectable } from "@nestjs/common";

@Injectable()
export class GreeterService {
  greet(name: string): { message: string } {
    return { message: `Hello, ${name}` };
  }
}
