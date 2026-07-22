import type { GreetingRepository } from "../application/greet.js";
import type { Greeting } from "../domain/greeting.js";

/** Infrastructure: in-memory store. */
export function createMemoryGreetingRepository(): GreetingRepository {
  const items: Greeting[] = [];
  return {
    save(greeting: Greeting) {
      items.push(greeting);
    },
  };
}
