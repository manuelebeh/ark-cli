import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { commandExists, ensureTool } from "../fs/command-exists.js";

export type PlainPhpBootstrapMethod = "composer" | "host";

export type PlainPythonBootstrapMethod = "uv" | "host" | "poetry";

export const PLAIN_PHP_BOOTSTRAP_OPTIONS: Array<{
  value: PlainPhpBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "composer",
    label: "Composer",
    hint: "composer init + PSR-4 autoload (default)",
  },
  {
    value: "host",
    label: "Host",
    hint: "Empty directory; Ark template only",
  },
];

export const PLAIN_PYTHON_BOOTSTRAP_OPTIONS: Array<{
  value: PlainPythonBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "uv",
    label: "uv",
    hint: "uv init --lib (src layout, default)",
  },
  {
    value: "host",
    label: "Host (venv)",
    hint: "python3 -m venv + empty project",
  },
  {
    value: "poetry",
    label: "Poetry",
    hint: "poetry new --src",
  },
];

export function isPlainPhpStack(stacks: string[]): boolean {
  const lower = stacks.map((s) => s.toLowerCase());
  return (
    lower.includes("php") &&
    !lower.includes("laravel") &&
    !lower.includes("symfony")
  );
}

export function isPlainPythonStack(stacks: string[]): boolean {
  const lower = stacks.map((s) => s.toLowerCase());
  return (
    lower.includes("python") &&
    !lower.includes("django") &&
    !lower.includes("fastapi")
  );
}

export function parsePlainPhpBootstrap(
  value: unknown,
): PlainPhpBootstrapMethod | undefined {
  if (value === "composer" || value === "host") return value;
  return undefined;
}

export function parsePlainPythonBootstrap(
  value: unknown,
): PlainPythonBootstrapMethod | undefined {
  if (value === "uv" || value === "host" || value === "poetry") return value;
  return undefined;
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

function pep503Name(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

function composerPackageName(name: string): string {
  const slug = pep503Name(name).replace(/-/g, "");
  return `app/${slug || "project"}`;
}

export function bootstrapPlainPhp(opts: {
  method: PlainPhpBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  assertEmptyOrMissing(targetDir);
  mkdirSync(targetDir, { recursive: true });

  switch (opts.method) {
    case "host":
      return;
    case "composer": {
      ensureTool("composer", "Install Composer: https://getcomposer.org/");
      const packageName = composerPackageName(opts.name);
      // Non-interactive init; fall back to a minimal composer.json if flags differ.
      const init = spawnSync(
        "composer",
        [
          "init",
          `--name=${packageName}`,
          "--description=Generated with Ark",
          "--type=project",
          "--stability=stable",
          "--license=MIT",
          "--autoload=psr-4",
          "App\\=src/",
          "--no-interaction",
        ],
        { cwd: targetDir, encoding: "utf8" },
      );
      if (init.status !== 0) {
        writeFileSync(
          join(targetDir, "composer.json"),
          `${JSON.stringify(
            {
              name: packageName,
              description: "Generated with Ark",
              type: "project",
              require: { php: ">=8.2" },
              autoload: { "psr-4": { "App\\": "src/" } },
            },
            null,
            4,
          )}\n`,
          "utf8",
        );
      }
      run("composer", ["dump-autoload", "--no-interaction"], {
        cwd: targetDir,
      });
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown plain PHP bootstrap: ${_exhaustive}`);
    }
  }
}

export function bootstrapPlainPython(opts: {
  method: PlainPythonBootstrapMethod;
  targetDir: string;
  name: string;
}): void {
  const targetDir = resolve(opts.targetDir);
  const parent = dirname(targetDir);
  const dirName = basename(targetDir);
  const projectName = pep503Name(opts.name);
  assertEmptyOrMissing(targetDir);

  switch (opts.method) {
    case "uv": {
      ensureTool("uv", "Install uv: https://docs.astral.sh/uv/");
      mkdirSync(targetDir, { recursive: true });
      run("uv", ["init", "--lib", "--name", projectName], { cwd: targetDir });
      return;
    }
    case "host": {
      const py = commandExists("python3")
        ? "python3"
        : commandExists("python")
          ? "python"
          : null;
      if (!py) {
        throw new Error(
          "Required tool not found: python3. Install Python 3.11+ or use --bootstrap uv.",
        );
      }
      mkdirSync(targetDir, { recursive: true });
      run(py, ["-m", "venv", ".venv"], { cwd: targetDir });
      return;
    }
    case "poetry": {
      ensureTool("poetry", "Install Poetry: https://python-poetry.org/");
      mkdirSync(parent, { recursive: true });
      run("poetry", ["new", dirName, "--name", projectName, "--src"], {
        cwd: parent,
      });
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown plain Python bootstrap: ${_exhaustive}`);
    }
  }
}
