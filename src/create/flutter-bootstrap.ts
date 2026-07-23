import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ensureTool } from "../fs/command-exists.js";

export type FlutterBootstrapMethod = "flutter-create" | "host";

export const FLUTTER_BOOTSTRAP_OPTIONS: Array<{
  value: FlutterBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "flutter-create",
    label: "flutter create",
    hint: "flutter create (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export function isFlutterStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "flutter");
}

export function parseFlutterBootstrap(
  value: unknown,
): FlutterBootstrapMethod | undefined {
  if (value === "flutter-create" || value === "host") return value;
  return undefined;
}

function sanitizeProjectName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

export function bootstrapFlutter(opts: {
  method: FlutterBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  assertEmptyOrMissing(targetDir);
  mkdirSync(targetDir, { recursive: true });

  switch (opts.method) {
    case "flutter-create": {
      ensureTool("flutter", "Install Flutter: https://flutter.dev/docs/get-started");
      const projectName = sanitizeProjectName(opts.name);
      run(
        "flutter",
        [
          "create",
          "--project-name",
          projectName,
          "--org",
          "com.example",
          ".",
        ],
        { cwd: targetDir },
      );
      return;
    }
    case "host": {
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown Flutter bootstrap method: ${_exhaustive}`);
    }
  }
}
