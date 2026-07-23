import * as p from "@clack/prompts";

/** True when stdin can drive Clack prompts. */
export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY);
}

/** Fail when a required value would need an interactive prompt. */
export function requireInteractive(flagHint: string): void {
  if (canPrompt()) return;
  p.cancel(`Non-interactive mode: pass ${flagHint}`);
  process.exit(1);
}

/** Exit with code 1 when the user cancels a Clack prompt. */
export function exitIfCancelled(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel("Cancelled");
    process.exit(1);
  }
}
