import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function applyTokens(input: string, vars: Record<string, string>): string {
  return input.replace(TOKEN_RE, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function copyTemplateDir(
  from: string,
  to: string,
  vars: Record<string, string>,
): void {
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const destName = applyTokens(entry, vars);
    const dest = join(to, destName);
    const st = statSync(src);

    if (st.isDirectory()) {
      copyTemplateDir(src, dest, vars);
      continue;
    }

    const content = readFileSync(src, "utf8");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, applyTokens(content, vars), "utf8");
  }
}

/**
 * Copy template files into an existing project. Skips destination files that
 * already exist. Skips the template root composer.json (merge separately).
 */
export function copyTemplateDirMerge(
  from: string,
  to: string,
  vars: Record<string, string>,
  options: {
    skipExisting?: boolean;
    /** Absolute path of the template root (to detect root composer.json). */
    templateRoot?: string;
  } = {},
): void {
  const skipExisting = options.skipExisting ?? true;
  const templateRoot = options.templateRoot ?? from;
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    const destName = applyTokens(entry, vars);
    const dest = join(to, destName);
    const st = statSync(src);

    if (st.isDirectory()) {
      copyTemplateDirMerge(src, dest, vars, {
        ...options,
        templateRoot,
      });
      continue;
    }

    const relFromTemplate = relative(templateRoot, src).split("\\").join("/");
    if (
      relFromTemplate === "composer.json" ||
      relFromTemplate === "pyproject.toml"
    ) {
      continue;
    }

    if (skipExisting && existsSync(dest)) {
      continue;
    }

    const content = readFileSync(src, "utf8");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, applyTokens(content, vars), "utf8");
  }
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge pack composer.json fields into an existing Laravel composer.json.
 * Adds missing require / require-dev / autoload.psr-4 / repositories /
 * config.allow-plugins / extra. Does not replace existing package versions.
 */
export function mergeComposerJson(targetPath: string, patchPath: string): void {
  if (!existsSync(targetPath) || !existsSync(patchPath)) return;

  const target = JSON.parse(readFileSync(targetPath, "utf8")) as JsonObject;
  const patch = JSON.parse(readFileSync(patchPath, "utf8")) as JsonObject;

  mergeStringMap(target, patch, "require");
  mergeStringMap(target, patch, "require-dev");

  if (isObject(patch.autoload) && isObject(patch.autoload["psr-4"])) {
    if (!isObject(target.autoload)) target.autoload = {};
    const targetAutoload = target.autoload as JsonObject;
    if (!isObject(targetAutoload["psr-4"])) targetAutoload["psr-4"] = {};
    const targetPsr4 = targetAutoload["psr-4"] as Record<string, string>;
    const patchPsr4 = patch.autoload["psr-4"] as Record<string, string>;
    for (const [ns, path] of Object.entries(patchPsr4)) {
      if (targetPsr4[ns] === undefined) targetPsr4[ns] = path;
    }
  }

  if (Array.isArray(patch.repositories)) {
    if (!Array.isArray(target.repositories)) target.repositories = [];
    const repos = target.repositories as unknown[];
    for (const repo of patch.repositories) {
      const key = JSON.stringify(repo);
      const exists = repos.some((r) => JSON.stringify(r) === key);
      if (!exists) repos.push(repo);
    }
  }

  if (isObject(patch.config) && isObject(patch.config["allow-plugins"])) {
    if (!isObject(target.config)) target.config = {};
    const targetConfig = target.config as JsonObject;
    if (!isObject(targetConfig["allow-plugins"])) {
      targetConfig["allow-plugins"] = {};
    }
    const targetPlugins = targetConfig["allow-plugins"] as Record<
      string,
      boolean
    >;
    const patchPlugins = patch.config["allow-plugins"] as Record<
      string,
      boolean
    >;
    for (const [plugin, enabled] of Object.entries(patchPlugins)) {
      if (targetPlugins[plugin] === undefined) targetPlugins[plugin] = enabled;
    }
  }

  if (isObject(patch.extra)) {
    if (!isObject(target.extra)) target.extra = {};
    const targetExtra = target.extra as JsonObject;
    for (const [key, value] of Object.entries(patch.extra)) {
      if (targetExtra[key] === undefined) {
        targetExtra[key] = value;
        continue;
      }
      if (
        key === "merge-plugin" &&
        isObject(value) &&
        Array.isArray(value.include) &&
        isObject(targetExtra["merge-plugin"])
      ) {
        const targetMerge = targetExtra["merge-plugin"] as JsonObject;
        const includes = Array.isArray(targetMerge.include)
          ? (targetMerge.include as string[])
          : [];
        for (const item of value.include as string[]) {
          if (!includes.includes(item)) includes.push(item);
        }
        targetMerge.include = includes;
      }
    }
  }

  writeFileSync(targetPath, `${JSON.stringify(target, null, 4)}\n`, "utf8");
}

/**
 * Merge pack pyproject.toml [project].dependencies into an existing file.
 * Adds missing dependency strings only (does not replace versions).
 */
export function mergePyprojectToml(
  targetPath: string,
  patchPath: string,
): void {
  if (!existsSync(targetPath) || !existsSync(patchPath)) return;

  const target = readFileSync(targetPath, "utf8");
  const patch = readFileSync(patchPath, "utf8");
  const patchDeps = extractPyprojectDependencies(patch);
  if (patchDeps.length === 0) return;

  const targetDeps = extractPyprojectDependencies(target);
  const existingNames = new Set(
    targetDeps.map((d) => dependencyName(d).toLowerCase()),
  );
  const missing = patchDeps.filter(
    (d) => !existingNames.has(dependencyName(d).toLowerCase()),
  );
  if (missing.length === 0) return;

  const depsBlock = /dependencies\s*=\s*\[([\s\S]*?)\]/m;
  const match = depsBlock.exec(target);
  if (!match) {
    // No dependencies table — append a minimal [project] dependencies list.
    const addition = [
      "",
      "[project]",
      "dependencies = [",
      ...missing.map((d) => `  "${escapeTomlString(d)}",`),
      "]",
      "",
    ].join("\n");
    writeFileSync(targetPath, `${target.trimEnd()}\n${addition}`, "utf8");
    return;
  }

  const inner = match[1] ?? "";
  const trimmedInner = inner.trimEnd();
  const needsNewline = trimmedInner.length > 0 && !trimmedInner.endsWith("\n");
  const insert = missing.map((d) => `  "${escapeTomlString(d)}",`).join("\n");
  const nextInner =
    trimmedInner.length === 0
      ? `\n${insert}\n`
      : `${trimmedInner}${needsNewline ? "\n" : ""}${insert}\n`;
  const next = `${target.slice(0, match.index)}dependencies = [${nextInner}]${target.slice(match.index + match[0].length)}`;
  writeFileSync(targetPath, next, "utf8");
}

function extractPyprojectDependencies(content: string): string[] {
  const match = /dependencies\s*=\s*\[([\s\S]*?)\]/m.exec(content);
  if (!match) return [];
  const inner = match[1] ?? "";
  const out: string[] = [];
  const re = /"([^"]+)"|'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    out.push(m[1] ?? m[2] ?? "");
  }
  return out.filter(Boolean);
}

function dependencyName(spec: string): string {
  const trimmed = spec.trim();
  const match = /^([A-Za-z0-9_.-]+)/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mergeStringMap(
  target: JsonObject,
  patch: JsonObject,
  key: string,
): void {
  if (!isObject(patch[key])) return;
  if (!isObject(target[key])) target[key] = {};
  const targetMap = target[key] as Record<string, string>;
  const patchMap = patch[key] as Record<string, string>;
  for (const [pkg, version] of Object.entries(patchMap)) {
    if (pkg === "php") continue;
    if (targetMap[pkg] === undefined) targetMap[pkg] = version;
  }
}

/** Framework dirs under app/ that are not business modules (folder-by-feature). */
export const LARAVEL_FRAMEWORK_APP_DIRS = [
  "Http",
  "Models",
  "Providers",
  "Console",
  "Exceptions",
  "Mail",
  "Jobs",
  "Listeners",
  "Policies",
  "Rules",
  "Notifications",
  "View",
  "Support",
  "Casts",
  "Enums",
  "Events",
  "Observers",
] as const;

export function writeFolderByFeatureExceptions(projectRoot: string): void {
  const lines = [
    "# Auto-generated by ark create --depth full",
    "# Laravel framework directories under app/ are not business feature modules.",
    "",
    "exceptions:",
  ];
  for (const dir of LARAVEL_FRAMEWORK_APP_DIRS) {
    lines.push(`  - code: missing-module-file`);
    lines.push(`    path: app/${dir}`);
    lines.push(`    reason: "Laravel framework directory"`);
    lines.push(`  - code: missing-module-file`);
    lines.push(`    path: app/${dir}/**`);
    lines.push(`    reason: "Laravel framework directory"`);
    lines.push(`  - code: module-naming`);
    lines.push(`    path: app/${dir}`);
    lines.push(`    reason: "Laravel framework directory"`);
  }
  lines.push("");
  writeFileSync(
    join(projectRoot, "architecture.exceptions.yaml"),
    lines.join("\n"),
    "utf8",
  );
}

export function pathExists(path: string): boolean {
  return existsSync(path);
}

export function copyDir(from: string, to: string): void {
  cpSync(from, to, { recursive: true });
}

const SKIP_WALK_DIRS = new Set([
  "node_modules",
  "dist",
  "vendor",
  "target",
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".dart_tool",
]);

export function listFilesRecursive(root: string): string[] {
  const out: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_WALK_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else {
        out.push(relative(root, full).split("\\").join("/"));
      }
    }
  }

  if (existsSync(root)) {
    walk(root);
  }
  return out;
}
