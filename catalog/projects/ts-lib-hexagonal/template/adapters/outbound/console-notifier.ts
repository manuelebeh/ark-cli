import type { GreetingNotifier } from "../../application/greet.js";
import type { Greeting } from "../../domain/greeting.js";

/** Outbound adapter: log greetings to stdout. */
export function createConsoleNotifier(): GreetingNotifier {
  return {
    notify(greeting: Greeting) {
      console.log(greeting.message);
    },
  };
}
