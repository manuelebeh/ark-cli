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

const SOURCE_EXT = /\.(tsx?|jsx?|mts|cts)$/;
const SKIP_DIR = /^(node_modules|dist|\.git)(\/|$)/;

const IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?|export\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)|(?:import|require)\s*\(\s*)['"]([^'"]+)['"]/g;

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
    (f) => SOURCE_EXT.test(f) && !SKIP_DIR.test(f),
  );

  for (const file of sourceFiles) {
    const abs = join(projectRoot, file);
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    for (const specifier of extractImportSpecifiers(content)) {
      const target = resolveRelativeImport(file, specifier, files);
      if (!target) continue;

      const fromModule = modulesPath
        ? moduleName(file, modulesPath)
        : null;
      const toModule = modulesPath
        ? moduleName(target, modulesPath)
        : null;

      if (fromModule && toModule && fromModule === toModule) {
        continue;
      }

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

function extractImportSpecifiers(content: string): string[] {
  const out: string[] = [];
  IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(content)) !== null) {
    out.push(match[1]!);
  }
  return out;
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
    `${normalized}/index.ts`,
    `${normalized}/index.tsx`,
    `${normalized}/index.js`,
    `${normalized}/index.jsx`,
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
