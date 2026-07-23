import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ensureTool } from "../fs/command-exists.js";

export type NuxtBootstrapMethod = "nuxi" | "host";

export const NUXT_BOOTSTRAP_OPTIONS: Array<{
  value: NuxtBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "nuxi",
    label: "nuxi / create-nuxt",
    hint: "npm create nuxt@latest (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export function isNuxtStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "nuxt");
}

export function parseNuxtBootstrap(
  value: unknown,
): NuxtBootstrapMethod | undefined {
  if (value === "nuxi" || value === "host") return value;
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

export function bootstrapNuxt(opts: {
  method: NuxtBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  const parent = dirname(targetDir);
  const dirName = basename(targetDir);
  assertEmptyOrMissing(targetDir);

  switch (opts.method) {
    case "nuxi": {
      ensureTool("npx", "Node.js/npm is required for Nuxt bootstrap");
      mkdirSync(parent, { recursive: true });
      const staging = join(parent, `${dirName}__ark_nuxt`);
      if (existsSync(staging)) {
        rmSync(staging, { recursive: true, force: true });
      }
      mkdirSync(staging, { recursive: true });
      // Non-interactive Nuxt 4 scaffold into a named folder under staging.
      run(
        "npx",
        [
          "--yes",
          "nuxi@latest",
          "init",
          dirName,
          "--packageManager",
          "npm",
          "--no-install",
          "--gitInit",
          "false",
        ],
        { cwd: staging },
      );
      const generated = join(staging, dirName);
      if (!existsSync(generated)) {
        // Fallback: create-nuxt style
        run(
          "npm",
          [
            "create",
            "nuxt@latest",
            dirName,
            "--",
            "--packageManager",
            "npm",
            "--no-install",
            "--gitInit",
            "false",
          ],
          { cwd: staging },
        );
      }
      if (!existsSync(generated)) {
        throw new Error(`Nuxt scaffold did not create ${generated}`);
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
      throw new Error(`Unknown Nuxt bootstrap method: ${_exhaustive}`);
    }
  }
}
