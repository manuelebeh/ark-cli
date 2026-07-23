import type { GreetingNotifier } from "../../application/greet";
import type { Greeting } from "../../domain/greeting";

/** Outbound adapter: log greetings to stdout. */
export function createConsoleNotifier(): GreetingNotifier {
  return {
    notify(greeting: Greeting) {
      console.log(greeting.message);
    },
  };
}
