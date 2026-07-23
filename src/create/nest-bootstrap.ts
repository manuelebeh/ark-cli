import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ensureTool } from "../fs/command-exists.js";

export type NestBootstrapMethod = "nest-cli" | "host";

export const NEST_BOOTSTRAP_OPTIONS: Array<{
  value: NestBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "nest-cli",
    label: "Nest CLI",
    hint: "npx @nestjs/cli new (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export function isNestStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "nest");
}

export function parseNestBootstrap(
  value: unknown,
): NestBootstrapMethod | undefined {
  if (value === "nest-cli" || value === "host") return value;
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

export function bootstrapNest(opts: {
  method: NestBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  const parent = dirname(targetDir);
  const dirName = basename(targetDir);
  assertEmptyOrMissing(targetDir);

  switch (opts.method) {
    case "nest-cli": {
      ensureTool("npx", "Node.js/npm is required for Nest CLI bootstrap");
      mkdirSync(parent, { recursive: true });
      const staging = join(parent, `${dirName}__ark_nest`);
      if (existsSync(staging)) {
        rmSync(staging, { recursive: true, force: true });
      }
      mkdirSync(staging, { recursive: true });
      run(
        "npx",
        [
          "--yes",
          "@nestjs/cli@latest",
          "new",
          dirName,
          "--package-manager",
          "npm",
          "--skip-git",
          "--strict",
        ],
        { cwd: staging },
      );
      const generated = join(staging, dirName);
      if (!existsSync(generated)) {
        throw new Error(`Nest CLI did not create ${generated}`);
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
      throw new Error(`Unknown Nest bootstrap method: ${_exhaustive}`);
    }
  }
}
