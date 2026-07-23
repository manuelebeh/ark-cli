import type { Greeting } from "../domain/greeting";
import { formatGreeting } from "../domain/greeting";

/** Port: how greetings are delivered. */
export type GreetingNotifier = {
  notify(greeting: Greeting): void;
};

export function greet(name: string, notifier: GreetingNotifier): Greeting {
  const greeting = formatGreeting(name);
  notifier.notify(greeting);
  return greeting;
}
