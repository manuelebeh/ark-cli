import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export type LaravelBootstrapMethod =
  | "laravel-installer"
  | "composer"
  | "sail"
  | "ddev";

export type LaravelDepth = "minimal" | "full";

export const LARAVEL_BOOTSTRAP_OPTIONS: Array<{
  value: LaravelBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "laravel-installer",
    label: "Laravel installer",
    hint: "laravel new (official CLI)",
  },
  {
    value: "composer",
    label: "Composer",
    hint: "composer create-project laravel/laravel",
  },
  {
    value: "sail",
    label: "Sail",
    hint: "laravel.build + Docker",
  },
  {
    value: "ddev",
    label: "DDEV",
    hint: "ddev config + composer create-project",
  },
];

export function parseLaravelDepth(value: unknown): LaravelDepth | undefined {
  if (value === "minimal" || value === "full") return value;
  return undefined;
}

export function parseLaravelBootstrap(
  value: unknown,
): LaravelBootstrapMethod | undefined {
  if (
    value === "laravel-installer" ||
    value === "composer" ||
    value === "sail" ||
    value === "ddev"
  ) {
    return value;
  }
  return undefined;
}

export function isLaravelStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "laravel");
}

function commandExists(command: string): boolean {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [command], { encoding: "utf8" });
  return result.status === 0;
}

function ensureTool(command: string, installHint: string): void {
  if (commandExists(command)) return;
  throw new Error(`Required tool not found: ${command}. ${installHint}`);
}

function run(
  command: string,
  args: string[],
  opts: { cwd: string; shell?: boolean },
): void {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    shell: opts.shell ?? false,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}`,
    );
  }
}

function assertEmptyOrMissing(dir: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${dir}`);
  }
}

/**
 * Bootstrap a full Laravel application into targetDir using the selected method.
 * targetDir must not exist or must be empty.
 */
export function bootstrapLaravel(opts: {
  method: LaravelBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  const parent = dirname(targetDir);
  const dirName = basename(targetDir);
  assertEmptyOrMissing(targetDir);

  switch (opts.method) {
    case "laravel-installer": {
      ensureTool(
        "laravel",
        "Install with: composer global require laravel/installer",
      );
      mkdirSync(parent, { recursive: true });
      const withNoInteraction = spawnSync(
        "laravel",
        ["new", dirName, "--no-interaction"],
        { cwd: parent, encoding: "utf8" },
      );
      if (withNoInteraction.status === 0) return;
      // Older installer builds may not support --no-interaction.
      run("laravel", ["new", dirName], { cwd: parent });
      return;
    }
    case "composer": {
      ensureTool("composer", "Install Composer: https://getcomposer.org/");
      mkdirSync(parent, { recursive: true });
      run(
        "composer",
        [
          "create-project",
          "laravel/laravel",
          dirName,
          "--prefer-dist",
          "--no-interaction",
        ],
        { cwd: parent },
      );
      return;
    }
    case "sail": {
      ensureTool("curl", "Install curl to use the Sail bootstrap.");
      ensureTool("docker", "Install Docker to use Laravel Sail.");
      mkdirSync(parent, { recursive: true });
      const script = `curl -sS "https://laravel.build/${dirName}" | bash`;
      run(script, [], { cwd: parent, shell: true });
      return;
    }
    case "ddev": {
      ensureTool("ddev", "Install DDEV: https://ddev.readthedocs.io/");
      mkdirSync(targetDir, { recursive: true });
      run(
        "ddev",
        ["config", "--project-type=laravel", "--docroot=public"],
        { cwd: targetDir },
      );
      run("ddev", ["start", "-y"], { cwd: targetDir });
      run("ddev", ["composer", "create-project", "laravel/laravel"], {
        cwd: targetDir,
      });
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown bootstrap method: ${_exhaustive}`);
    }
  }
}
