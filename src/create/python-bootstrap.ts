import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { commandExists, ensureTool } from "../fs/command-exists.js";

export type DjangoBootstrapMethod =
  | "uv"
  | "host"
  | "poetry"
  | "cookiecutter-django"
  | "django-admin";

export type FastapiBootstrapMethod =
  | "uv"
  | "host"
  | "poetry"
  | "cookiecutter";

export type PythonBootstrapMethod =
  | DjangoBootstrapMethod
  | FastapiBootstrapMethod;

export const DJANGO_BOOTSTRAP_OPTIONS: Array<{
  value: DjangoBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "uv",
    label: "uv",
    hint: "uv init + uv add django + startproject (default)",
  },
  {
    value: "host",
    label: "Host (venv)",
    hint: "python3 -m venv + pip + django-admin",
  },
  {
    value: "poetry",
    label: "Poetry",
    hint: "poetry new + poetry add django",
  },
  {
    value: "cookiecutter-django",
    label: "cookiecutter-django",
    hint: "cookiecutter/cookiecutter-django --no-input",
  },
  {
    value: "django-admin",
    label: "django-admin",
    hint: "django-admin startproject (Django already on PATH)",
  },
];

export const FASTAPI_BOOTSTRAP_OPTIONS: Array<{
  value: FastapiBootstrapMethod;
  label: string;
  hint: string;
}> = [
  {
    value: "uv",
    label: "uv",
    hint: "uv init --app + uv add fastapi (default)",
  },
  {
    value: "host",
    label: "Host (venv)",
    hint: "python3 -m venv + pip install fastapi",
  },
  {
    value: "poetry",
    label: "Poetry",
    hint: "poetry new + poetry add fastapi",
  },
  {
    value: "cookiecutter",
    label: "cookiecutter",
    hint: "cookiecutter FastAPI template --no-input",
  },
];

export function isDjangoStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "django");
}

export function isFastapiStack(stacks: string[]): boolean {
  return stacks.some((s) => s.toLowerCase() === "fastapi");
}

export function isPythonFrameworkStack(stacks: string[]): boolean {
  return isDjangoStack(stacks) || isFastapiStack(stacks);
}

export function parseDjangoBootstrap(
  value: unknown,
): DjangoBootstrapMethod | undefined {
  if (
    value === "uv" ||
    value === "host" ||
    value === "poetry" ||
    value === "cookiecutter-django" ||
    value === "django-admin"
  ) {
    return value;
  }
  return undefined;
}

export function parseFastapiBootstrap(
  value: unknown,
): FastapiBootstrapMethod | undefined {
  if (
    value === "uv" ||
    value === "host" ||
    value === "poetry" ||
    value === "cookiecutter"
  ) {
    return value;
  }
  return undefined;
}


function run(
  command: string,
  args: string[],
  opts: { cwd: string; shell?: boolean; env?: NodeJS.ProcessEnv },
): void {
  const result = spawnSync(command, args, {
    cwd: opts.cwd,
    shell: opts.shell ?? false,
    stdio: "inherit",
    encoding: "utf8",
    env: opts.env ?? process.env,
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

function pythonBin(): string {
  if (commandExists("python3")) return "python3";
  if (commandExists("python")) return "python";
  throw new Error(
    "Required tool not found: python3. Install Python 3.11+ or use --bootstrap uv.",
  );
}

function venvPython(targetDir: string): string {
  return process.platform === "win32"
    ? join(targetDir, ".venv", "Scripts", "python.exe")
    : join(targetDir, ".venv", "bin", "python");
}

function pep503Name(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

function moveContentsUp(fromDir: string, toDir: string): void {
  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir)) {
    renameSync(join(fromDir, entry), join(toDir, entry));
  }
  rmSync(fromDir, { recursive: true, force: true });
}

export function bootstrapDjango(opts: {
  method: DjangoBootstrapMethod;
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
      run("uv", ["init", "--name", projectName], { cwd: targetDir });
      run("uv", ["add", "django"], { cwd: targetDir });
      run("uv", ["run", "django-admin", "startproject", "config", "."], {
        cwd: targetDir,
      });
      return;
    }
    case "host": {
      const py = pythonBin();
      mkdirSync(targetDir, { recursive: true });
      run(py, ["-m", "venv", ".venv"], { cwd: targetDir });
      const vpy = venvPython(targetDir);
      run(vpy, ["-m", "pip", "install", "--upgrade", "pip"], {
        cwd: targetDir,
      });
      run(vpy, ["-m", "pip", "install", "django"], { cwd: targetDir });
      run(vpy, ["-m", "django", "startproject", "config", "."], {
        cwd: targetDir,
      });
      return;
    }
    case "poetry": {
      ensureTool("poetry", "Install Poetry: https://python-poetry.org/");
      mkdirSync(parent, { recursive: true });
      run("poetry", ["new", dirName, "--name", projectName], { cwd: parent });
      run("poetry", ["add", "django"], { cwd: targetDir });
      run("poetry", ["run", "django-admin", "startproject", "config", "."], {
        cwd: targetDir,
      });
      return;
    }
    case "cookiecutter-django": {
      ensureTool(
        "cookiecutter",
        "Install cookiecutter: pipx install cookiecutter",
      );
      mkdirSync(parent, { recursive: true });
      run(
        "cookiecutter",
        [
          "gh:cookiecutter/cookiecutter-django",
          "--no-input",
          `project_name=${opts.name}`,
          `project_slug=${dirName}`,
        ],
        { cwd: parent },
      );
      return;
    }
    case "django-admin": {
      ensureTool(
        "django-admin",
        "Install Django (pip install django) or use --bootstrap uv|host.",
      );
      mkdirSync(targetDir, { recursive: true });
      run("django-admin", ["startproject", "config", "."], { cwd: targetDir });
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown Django bootstrap method: ${_exhaustive}`);
    }
  }
}

export function bootstrapFastapi(opts: {
  method: FastapiBootstrapMethod;
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
      run("uv", ["init", "--app", "--name", projectName], { cwd: targetDir });
      run("uv", ["add", "fastapi[standard]"], { cwd: targetDir });
      return;
    }
    case "host": {
      const py = pythonBin();
      mkdirSync(targetDir, { recursive: true });
      run(py, ["-m", "venv", ".venv"], { cwd: targetDir });
      const vpy = venvPython(targetDir);
      run(vpy, ["-m", "pip", "install", "--upgrade", "pip"], {
        cwd: targetDir,
      });
      run(vpy, ["-m", "pip", "install", "fastapi[standard]"], {
        cwd: targetDir,
      });
      return;
    }
    case "poetry": {
      ensureTool("poetry", "Install Poetry: https://python-poetry.org/");
      mkdirSync(parent, { recursive: true });
      run("poetry", ["new", dirName, "--name", projectName], { cwd: parent });
      run("poetry", ["add", "fastapi[standard]"], { cwd: targetDir });
      return;
    }
    case "cookiecutter": {
      ensureTool(
        "cookiecutter",
        "Install cookiecutter: pipx install cookiecutter",
      );
      mkdirSync(parent, { recursive: true });
      // Generates into a nested folder named after project_slug; flatten into targetDir.
      const staging = join(parent, `${dirName}__ark_cookiecutter`);
      if (existsSync(staging)) {
        rmSync(staging, { recursive: true, force: true });
      }
      run(
        "cookiecutter",
        [
          "gh:arthurhenrique/cookiecutter-fastapi",
          "--no-input",
          `project_name=${opts.name}`,
          `project_slug=${dirName}`,
          "--output-dir",
          staging,
        ],
        { cwd: parent },
      );
      const generated = join(staging, dirName);
      if (existsSync(generated)) {
        moveContentsUp(generated, targetDir);
        rmSync(staging, { recursive: true, force: true });
      } else {
        // Some templates write directly under output-dir.
        moveContentsUp(staging, targetDir);
      }
      return;
    }
    default: {
      const _exhaustive: never = opts.method;
      throw new Error(`Unknown FastAPI bootstrap method: ${_exhaustive}`);
    }
  }
}
