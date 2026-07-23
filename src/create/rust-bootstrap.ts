import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ensureTool } from "../fs/command-exists.js";

export type RustBootstrapMethod = "cargo-init" | "host";

export const RUST_BOOTSTRAP_OPTIONS: Array<{
  value: RustBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "cargo-init",
    label: "cargo init",
    hint: "cargo init (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export function isRustStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "rust");
}

export function parseRustBootstrap(
  value: unknown,
): RustBootstrapMethod | undefined {
  if (value === "cargo-init" || value === "host") return value;
  return undefined;
}

function sanitizeCrateName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
  const withLetter = /^[a-z]/.test(cleaned) ? cleaned : `app_${cleaned}`;
  return withLetter || "app";
}

function run(
  command: string,
  args: string[],
  opts: { cwd: string },
): void {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}`,
    );
  }
}

function assertEmptyOrMissing(dir: string): void {
  if (!existsSync(dir)) return;
  if (readdirSync(dir).length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
}

export function bootstrapRust(opts: {
  method: RustBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  assertEmptyOrMissing(targetDir);
  mkdirSync(targetDir, { recursive: true });

  switch (opts.method) {
    case "cargo-init": {
      ensureTool("cargo", "Install Rust: https://rustup.rs/");
      const crateName = sanitizeCrateName(opts.name);
      run("cargo", ["init", "--name", crateName, "--bin", "."], {
        cwd: targetDir,
      });
      return;
    }
    case "host": {
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown Rust bootstrap method: ${_exhaustive}`);
    }
  }
}
