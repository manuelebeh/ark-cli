import { spawnSync } from "node:child_process";

export function commandExists(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [command], { encoding: "utf8" });
  return result.status === 0;
}

export function ensureTool(command: string, installHint: string): void {
  if (commandExists(command)) return;
  throw new Error(`Required tool not found: ${command}. ${installHint}`);
}
