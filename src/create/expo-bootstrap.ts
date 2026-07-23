import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ensureTool } from "../fs/command-exists.js";

export type ExpoBootstrapMethod = "create-expo-app" | "host";

export const EXPO_BOOTSTRAP_OPTIONS: Array<{
  value: ExpoBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "create-expo-app",
    label: "create-expo-app",
    hint: "npx create-expo-app blank-typescript (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export function isExpoStack(stacks: string[]): boolean {
  const lower = stacks.map((s) => s.toLowerCase());
  return (
    lower.includes("expo") ||
    (lower.includes("react-native") && lower.includes("mobile"))
  );
}

export function parseExpoBootstrap(
  value: unknown,
): ExpoBootstrapMethod | undefined {
  if (value === "create-expo-app" || value === "host") return value;
  return undefined;
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

function moveContentsUp(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    renameSync(join(from, name), join(to, name));
  }
}

export function bootstrapExpo(opts: {
  method: ExpoBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  const parent = dirname(targetDir);
  const dirName = basename(targetDir);
  assertEmptyOrMissing(targetDir);

  switch (opts.method) {
    case "create-expo-app": {
      ensureTool("npx", "Node.js/npm is required for Expo bootstrap");
      mkdirSync(parent, { recursive: true });
      const staging = join(parent, `${dirName}__ark_expo`);
      if (existsSync(staging)) {
        rmSync(staging, { recursive: true, force: true });
      }
      mkdirSync(staging, { recursive: true });
      run(
        "npx",
        [
          "--yes",
          "create-expo-app@latest",
          dirName,
          "--template",
          "blank-typescript",
        ],
        { cwd: staging },
      );
      const generated = join(staging, dirName);
      if (!existsSync(generated)) {
        throw new Error(`create-expo-app did not create ${generated}`);
      }
      moveContentsUp(generated, targetDir);
      rmSync(staging, { recursive: true, force: true });
      return;
    }
    case "host": {
      mkdirSync(targetDir, { recursive: true });
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown Expo bootstrap method: ${_exhaustive}`);
    }
  }
}
