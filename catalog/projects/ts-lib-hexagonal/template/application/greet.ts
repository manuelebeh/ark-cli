import type { Greeting } from "../domain/greeting.js";
import { formatGreeting } from "../domain/greeting.js";

/** Port: how greetings are delivered. */
export type GreetingNotifier = {
  notify(greeting: Greeting): void;
};

export function greet(name: string, notifier: GreetingNotifier): Greeting {
  const greeting = formatGreeting(name);
  notifier.notify(greeting);
  return greeting;
}
