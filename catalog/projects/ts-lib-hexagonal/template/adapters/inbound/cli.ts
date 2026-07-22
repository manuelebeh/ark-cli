import { greet } from "../../application/greet.js";
import { createConsoleNotifier } from "../outbound/console-notifier.js";

/** Inbound adapter: run a sample greet from the CLI entry. */
export function runSample(name = "world"): void {
  greet(name, createConsoleNotifier());
}
