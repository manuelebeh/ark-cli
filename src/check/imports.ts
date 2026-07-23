import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import type {
  ArchitectureManifest,
  CheckIssue,
  Conventions,
  ImportRule,
} from "../types.js";
import { matchImportGlob, matchSimpleGlob } from "./glob.js";
import { resolveSeverity } from "./severity.js";

const JS_SOURCE_EXT = /\.(tsx?|jsx?|mts|cts)$/;
const PHP_SOURCE_EXT = /\.php$/;
const PY_SOURCE_EXT = /\.py$/;
const GO_SOURCE_EXT = /\.go$/;
const DART_SOURCE_EXT = /\.dart$/;
const RUST_SOURCE_EXT = /\.rs$/;
const SKIP_DIR =
  /^(node_modules|dist|vendor|target|\.git|\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|\.ruff_cache|\.tox|\.dart_tool|\.pub-cache)(\/|$)/;

const IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?|export\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)|(?:import|require)\s*\(\s*)['"]([^'"]+)['"]/g;

const PHP_USE_RE =
  /^use\s+(?!function\b|const\b)([A-Za-z_][A-Za-z0-9_\\]*)(?:\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?\s*;/gm;

const PY_FROM_RE =
  /^\s*from\s+(\.+[\w.]*|[\w.]+)\s+import\s+/gm;
const PY_IMPORT_RE = /^\s*import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;

export function parseModulesPath(pathPattern: string): {
  parentDir: string;
  placeholder: string;
} {
  const trimmed = pathPattern.replace(/\/$/, "");
  const parts = trimmed.split("/");
  const last = parts[parts.length - 1] ?? "";
  if (!last.startsWith(":") || parts.length < 2) {
    throw new Error(
      `Invalid modules.path "${pathPattern}" (expected e.g. features/:name)`,
    );
  }
  return {
    parentDir: parts.slice(0, -1).join("/"),
    placeholder: last.slice(1),
  };
}

export function checkImports(
  projectRoot: string,
  files: string[],
  conventions: Conventions,
  manifest: ArchitectureManifest,
  modulesPath?: string,
): CheckIssue[] {
  const deny = conventions.imports?.deny ?? [];
  const allow = conventions.imports?.allow ?? [];
  const crossModuleBlocked =
    conventions.placement?.cross_module_imports === false;
  const publicApi = conventions.placement?.public_api;

  if (deny.length === 0 && !crossModuleBlocked) {
    return [];
  }

  const issues: CheckIssue[] = [];
  const sourceFiles = files.filter(
    (f) =>
      (JS_SOURCE_EXT.test(f) ||
        PHP_SOURCE_EXT.test(f) ||
        PY_SOURCE_EXT.test(f) ||
        GO_SOURCE_EXT.test(f) ||
        DART_SOURCE_EXT.test(f) ||
        RUST_SOURCE_EXT.test(f)) &&
      !SKIP_DIR.test(f),
  );

  const goModulePath = readGoModulePath(projectRoot);
  const dartPackageName = readPubspecPackageName(projectRoot);

  for (const file of sourceFiles) {
    const abs = join(projectRoot, file);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const targets = DART_SOURCE_EXT.test(file)
      ? extractDartImportTargets(file, content, files, dartPackageName)
      : RUST_SOURCE_EXT.test(file)
        ? extractRustImportTargets(file, content, files)
        : GO_SOURCE_EXT.test(file)
          ? extractGoImportTargets(content, files, goModulePath)
          : PY_SOURCE_EXT.test(file)
            ? extractPyImportTargets(file, content, files)
            : PHP_SOURCE_EXT.test(file)
              ? extractPhpImportTargets(content, files)
              : extractJsImportTargets(file, content, files);

    for (const target of targets) {
      const fromModule = modulesPath
        ? moduleName(file, modulesPath)
        : null;
      const toModule = modulesPath
        ? moduleName(target, modulesPath)
        : null;

      if (matchesAnyRule(file, target, allow)) {
        continue;
      }

      const denyRule = findMatchingRule(file, target, deny);
      if (denyRule) {
        issues.push({
          severity: resolveSeverity(
            manifest,
            "denied-import",
            denyRule.severity,
          ),
          code: "denied-import",
          message: `Import from "${file}" to "${target}" is denied (${denyRule.from} → ${denyRule.to})`,
          path: file,
        });
        continue;
      }

      if (fromModule && toModule && fromModule === toModule) {
        continue;
      }

      if (
        crossModuleBlocked &&
        modulesPath &&
        publicApi &&
        fromModule &&
        toModule &&
        fromModule !== toModule &&
        !isPublicApi(target, toModule, publicApi)
      ) {
        issues.push({
          severity: resolveSeverity(manifest, "cross-module-import"),
          code: "cross-module-import",
          message: `Cross-module import from "${fromModule}" to "${toModule}" must go through the public API`,
          path: file,
        });
      }
    }
  }

  return issues;
}

function extractJsImportTargets(
  file: string,
  content: string,
  files: string[],
): string[] {
  const out: string[] = [];
  for (const specifier of extractImportSpecifiers(content)) {
    const target = resolveRelativeImport(file, specifier, files);
    if (target) out.push(target);
  }
  return out;
}

function extractPhpImportTargets(content: string, files: string[]): string[] {
  const out: string[] = [];
  for (const fqcn of extractPhpUseNames(content)) {
    const target = resolvePhpUseToPath(fqcn, files);
    if (target) out.push(target);
  }
  return out;
}

function extractPyImportTargets(
  file: string,
  content: string,
  files: string[],
): string[] {
  const out: string[] = [];
  for (const spec of extractPyImportSpecifiers(content)) {
    const target = resolvePyImportToPath(file, spec, files);
    if (target) out.push(target);
  }
  return out;
}

function extractPyImportSpecifiers(content: string): string[] {
  const out: string[] = [];
  PY_FROM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PY_FROM_RE.exec(content)) !== null) {
    out.push(match[1]!);
  }
  PY_IMPORT_RE.lastIndex = 0;
  while ((match = PY_IMPORT_RE.exec(content)) !== null) {
    const names = match[1]!.split(",").map((s) => s.trim().split(/\s+as\s+/)[0]!.trim());
    for (const name of names) {
      if (name) out.push(name);
    }
  }
  return out;
}

/**
 * Map a Python import specifier to a project-relative path (best-effort).
 */
export function resolvePyImportToPath(
  fromFile: string,
  specifier: string,
  files: string[],
): string | null {
  if (!specifier || specifier === "__future__") return null;

  // Relative: from .service / from ..domain.account_id
  if (specifier.startsWith(".")) {
    return resolvePyRelativeImport(fromFile, specifier, files);
  }

  // Absolute package path: apps.accounts.models → apps/accounts/models.py
  const parts = specifier.split(".").filter(Boolean);
  if (parts.length === 0) return null;

  // Skip obvious stdlib / third-party top-levels unless they exist in the tree.
  const root = parts[0]!;
  const projectRoots = new Set([
    "apps",
    "features",
    "domains",
    "contexts",
    "shared",
    "config",
    "api",
    "services",
    "models",
    "schemas",
    "repositories",
    "domain",
    "application",
    "infrastructure",
    "presentation",
    "app",
    "src",
    "actions",
    "readers",
    "data",
    "interfaces",
    "core",
  ]);
  const fileSet = new Set(files);
  if (!projectRoots.has(root)) {
    const probe = joinPosix(parts) + ".py";
    const probeInit = joinPosix([...parts, "__init__.py"]);
    if (!fileSet.has(probe) && !fileSet.has(probeInit)) {
      return null;
    }
  }

  const candidates = [
    joinPosix(parts) + ".py",
    joinPosix([...parts, "__init__.py"]),
  ];
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return candidates[0] ?? null;
}

function resolvePyRelativeImport(
  fromFile: string,
  specifier: string,
  files: string[],
): string | null {
  let dots = 0;
  while (specifier[dots] === ".") dots += 1;
  const rest = specifier.slice(dots);
  const fromDir = dirname(fromFile);
  let base = fromDir;
  // PEP 328: one leading dot = current package; each extra dot = parent.
  for (let i = 1; i < dots; i += 1) {
    base = dirname(base);
  }
  const parts = rest ? rest.split(".").filter(Boolean) : [];
  const joined = joinPosix(
    [...base.split("/").filter(Boolean), ...parts],
  );
  const fileSet = new Set(files);
  const candidates = [
    `${joined}.py`,
    joinPosix([joined, "__init__.py"]),
  ];
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return candidates[0] ?? null;
}

function extractImportSpecifiers(content: string): string[] {
  const out: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    out.push(match[1]!);
  }
  return out;
}

/** Read `module` path from go.mod at project root, or null. */
export function readGoModulePath(projectRoot: string): string | null {
  const modPath = join(projectRoot, "go.mod");
  try {
    const content = readFileSync(modPath, "utf8");
    const m = /^module\s+(\S+)/m.exec(content);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract Go import paths from single-line and parenthesized import blocks.
 */
export function extractGoImportSpecifiers(content: string): string[] {
  const out: string[] = [];
  const single =
    /^\s*import\s+(?:[_.]\s+|[\w]+\s+)?"([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = single.exec(content)) !== null) {
    out.push(match[1]!);
  }

  const blockRe = /^\s*import\s*\(\s*([\s\S]*?)\s*\)/gm;
  while ((match = blockRe.exec(content)) !== null) {
    const body = match[1]!;
    const lineRe = /^\s*(?:[_.]\s+|[\w]+\s+)?"([^"]+)"/gm;
    let line: RegExpExecArray | null;
    while ((line = lineRe.exec(body)) !== null) {
      out.push(line[1]!);
    }
  }
  return out;
}

function isGoStdlib(specifier: string): boolean {
  const first = specifier.split("/")[0] ?? "";
  return first.length > 0 && !first.includes(".");
}

/**
 * Map a Go import path to a project-relative .go file (best-effort).
 */
export function resolveGoImportToPath(
  specifier: string,
  files: string[],
  modulePath: string | null,
): string | null {
  if (!specifier || specifier === "C") return null;
  if (isGoStdlib(specifier)) return null;
  if (!modulePath) return null;
  const prefix = modulePath.endsWith("/") ? modulePath : `${modulePath}/`;
  if (!specifier.startsWith(prefix) && specifier !== modulePath) {
    return null;
  }
  const rel =
    specifier === modulePath ? "" : specifier.slice(prefix.length);
  if (!rel) return null;

  const fileSet = new Set(files);
  const inPkg = files
    .filter((f) => {
      if (!GO_SOURCE_EXT.test(f) || f.endsWith("_test.go")) return false;
      if (f === `${rel}.go`) return true;
      if (!f.startsWith(`${rel}/`)) return false;
      return !f.slice(rel.length + 1).includes("/");
    })
    .sort();
  if (inPkg.length > 0) return inPkg[0]!;

  // Directory package with nested files still matchable via globs
  const anyUnder = files.find(
    (f) => GO_SOURCE_EXT.test(f) && f.startsWith(`${rel}/`),
  );
  if (anyUnder) return anyUnder;

  return `${rel}/pkg.go`;
}

function extractGoImportTargets(
  content: string,
  files: string[],
  modulePath: string | null,
): string[] {
  const out: string[] = [];
  for (const spec of extractGoImportSpecifiers(content)) {
    const resolved = resolveGoImportToPath(spec, files, modulePath);
    if (resolved) out.push(resolved);
  }
  return out;
}

/** Read package `name:` from pubspec.yaml, or null. */
export function readPubspecPackageName(projectRoot: string): string | null {
  const path = join(projectRoot, "pubspec.yaml");
  try {
    const content = readFileSync(path, "utf8");
    const m = /^name:\s*([A-Za-z_][\w]*)/m.exec(content);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

const DART_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]/gm;

export function extractDartImportSpecifiers(content: string): string[] {
  const out: string[] = [];
  DART_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DART_IMPORT_RE.exec(content)) !== null) {
    out.push(match[1]!);
  }
  return out;
}

export function resolveDartImportToPath(
  fromFile: string,
  specifier: string,
  files: string[],
  packageName: string | null,
): string | null {
  if (!specifier) return null;
  if (specifier.startsWith("dart:")) return null;

  if (specifier.startsWith("package:")) {
    const rest = specifier.slice("package:".length);
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const pkg = rest.slice(0, slash);
    const pathPart = rest.slice(slash + 1);
    if (!packageName || pkg !== packageName) return null;
    const base = `lib/${pathPart}`.replace(/\.dart$/, "");
    return resolveDartFileCandidates(base, files);
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const fromDir = dirname(fromFile);
    const joined = normalize(join(fromDir, specifier)).split("\\").join("/");
    const normalized = joined.replace(/^\.\//, "");
    if (normalized.startsWith("..") || normalized.includes("/../")) return null;
    const base = normalized.replace(/\.dart$/, "");
    return resolveDartFileCandidates(base, files);
  }

  return null;
}

function resolveDartFileCandidates(
  base: string,
  files: string[],
): string | null {
  const fileSet = new Set(files);
  const candidates = [`${base}.dart`, `${base}/index.dart`];
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return `${base}.dart`;
}

function extractDartImportTargets(
  fromFile: string,
  content: string,
  files: string[],
  packageName: string | null,
): string[] {
  const out: string[] = [];
  for (const spec of extractDartImportSpecifiers(content)) {
    const resolved = resolveDartImportToPath(
      fromFile,
      spec,
      files,
      packageName,
    );
    if (resolved) out.push(resolved);
  }
  return out;
}

const RUST_USE_RE =
  /^\s*use\s+(crate|super|self)((?:::[A-Za-z_][\w]*)+)/gm;

export function extractRustUsePaths(content: string): string[] {
  const out: string[] = [];
  RUST_USE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RUST_USE_RE.exec(content)) !== null) {
    const root = match[1]!;
    const rest = match[2]!.replace(/^::/, "").split("::").filter(Boolean);
    // Drop trailing item if it looks like a value/type import of last segment
    // Keep full module path for resolution; last segment may be type or module.
    out.push([root, ...rest].join("::"));
  }
  return out;
}

export function resolveRustUseToPath(
  fromFile: string,
  usePath: string,
  files: string[],
): string | null {
  const parts = usePath.split("::").filter(Boolean);
  if (parts.length === 0) return null;
  const root = parts[0]!;
  if (root !== "crate" && root !== "super" && root !== "self") return null;

  let modParts: string[] = [];
  if (root === "crate") {
    modParts = parts.slice(1);
  } else if (root === "self") {
    modParts = [...rustModuleDir(fromFile), ...parts.slice(1)];
  } else {
    // super::… — count leading `super` segments after the first
    const tail = parts.slice(1);
    let climb = 1;
    let i = 0;
    while (i < tail.length && tail[i] === "super") {
      climb += 1;
      i += 1;
    }
    const fromDir = rustModuleDir(fromFile);
    modParts = [
      ...fromDir.slice(0, Math.max(0, fromDir.length - climb)),
      ...tail.slice(i),
    ];
  }

  if (modParts.length === 0) return null;
  return resolveRustModuleFile(modParts, files);
}

function rustModuleDir(fromFile: string): string[] {
  // src/domain/greeting.rs → ["domain"]
  // src/domain/mod.rs → ["domain"]
  // src/main.rs → []
  // src/lib.rs → []
  const posix = fromFile.split("\\").join("/");
  if (!posix.startsWith("src/")) return [];
  const rel = posix.slice("src/".length);
  if (rel === "main.rs" || rel === "lib.rs") return [];
  const segments = rel.split("/");
  const last = segments[segments.length - 1]!;
  if (last === "mod.rs") {
    return segments.slice(0, -1);
  }
  if (last.endsWith(".rs")) {
    return [...segments.slice(0, -1), last.replace(/\.rs$/, "")];
  }
  return segments;
}

function resolveRustModuleFile(
  modParts: string[],
  files: string[],
): string | null {
  const fileSet = new Set(files);
  // Try progressively dropping the last segment (type vs module).
  for (let len = modParts.length; len >= 1; len -= 1) {
    const parts = modParts.slice(0, len);
    const candidates = [
      joinPosix(["src", ...parts]) + ".rs",
      joinPosix(["src", ...parts, "mod.rs"]),
    ];
    for (const c of candidates) {
      if (fileSet.has(c)) return c;
    }
  }
  return joinPosix(["src", ...modParts]) + ".rs";
}

function extractRustImportTargets(
  fromFile: string,
  content: string,
  files: string[],
): string[] {
  const out: string[] = [];
  for (const usePath of extractRustUsePaths(content)) {
    const resolved = resolveRustUseToPath(fromFile, usePath, files);
    if (resolved) out.push(resolved);
  }
  return out;
}

function extractPhpUseNames(content: string): string[] {
  const out: string[] = [];
  PHP_USE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PHP_USE_RE.exec(content)) !== null) {
    const name = match[1]!;
    // Skip grouped use Foo\{Bar, Baz}
    if (name.includes("{")) continue;
    out.push(name);
  }
  return out;
}

/**
 * Map a PHP FQCN to a project-relative path (best-effort PSR-4 heuristics).
 */
export function resolvePhpUseToPath(
  fqcn: string,
  files: string[],
): string | null {
  const parts = fqcn.split("\\").filter(Boolean);
  if (parts.length < 2) return null;

  const candidates: string[] = [];
  const root = parts[0]!;

  if (root === "App") {
    candidates.push(joinPosix(["app", ...parts.slice(1)]) + ".php");
  } else if (root === "Shared") {
    candidates.push(joinPosix(["shared", ...parts.slice(1)]) + ".php");
    candidates.push(joinPosix(["app", "Shared", ...parts.slice(1)]) + ".php");
  } else if (root === "Modules") {
    const moduleName = parts[1];
    const rest = parts.slice(2);
    if (moduleName) {
      // nwidart: Modules\Accounts\* → Modules/Accounts/app/*
      candidates.push(
        joinPosix(["Modules", moduleName, "app", ...rest]) + ".php",
      );
      // InterNACHI: Modules\Accounts\* → app-modules/accounts/src/*
      candidates.push(
        joinPosix([
          "app-modules",
          pascalToKebab(moduleName),
          "src",
          ...rest,
        ]) + ".php",
      );
    }
  }

  if (candidates.length === 0) return null;

  const fileSet = new Set(files);
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }
  return candidates[0] ?? null;
}

function joinPosix(parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

function pascalToKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** Resolve relative imports only; returns project-relative path or null. */
function resolveRelativeImport(
  fromFile: string,
  specifier: string,
  files: string[],
): string | null {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }

  const fromDir = dirname(fromFile);
  const joined = normalize(join(fromDir, specifier)).split("\\").join("/");
  const normalized = joined.replace(/^\.\//, "");

  if (normalized.startsWith("..") || normalized.includes("/../")) {
    return null;
  }

  const candidates = [
    normalized,
    `${normalized}.ts`,
    `${normalized}.tsx`,
    `${normalized}.js`,
    `${normalized}.jsx`,
    `${normalized}.mts`,
    `${normalized}.cts`,
    `${normalized}.php`,
    `${normalized}.py`,
    `${normalized}.dart`,
    `${normalized}.rs`,
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
    `${normalized}/index.php`,
    `${normalized}/__init__.py`,
    `${normalized}/index.dart`,
    `${normalized}/mod.rs`,
  ];

  const fileSet = new Set(files);
  for (const c of candidates) {
    if (fileSet.has(c)) return c;
  }

  // Still return the best-effort path so glob rules can match missing files
  // that clearly target a module tree (e.g. ../other/ui/Foo).
  return normalized;
}

function moduleName(path: string, modulesPath: string): string | null {
  const { parentDir } = parseModulesPath(modulesPath);
  const escaped = parentDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^${escaped}/([^/]+)/`).exec(path);
  return m?.[1] ?? null;
}

function matchesAnyRule(
  from: string,
  to: string,
  rules: ImportRule[],
): boolean {
  return findMatchingRule(from, to, rules) !== undefined;
}

function findMatchingRule(
  from: string,
  to: string,
  rules: ImportRule[],
): ImportRule | undefined {
  return rules.find(
    (rule) =>
      matchImportGlob(from, rule.from) && matchImportGlob(to, rule.to),
  );
}

function isPublicApi(
  target: string,
  name: string,
  publicApiPattern: string,
): boolean {
  const pattern = publicApiPattern.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, name);
  return matchSimpleGlob(target, pattern);
}
