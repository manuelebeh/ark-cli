import type { Greeting } from "../domain/greeting";
import { formatGreeting } from "../domain/greeting";

export type GreetingRepository = {
  save(greeting: Greeting): void;
};

export function greet(name: string, repo: GreetingRepository): Greeting {
  const greeting = formatGreeting(name);
  repo.save(greeting);
  return greeting;
}
