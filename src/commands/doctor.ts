import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { detectStacks } from "../adopt/detect.js";
import { loadArkProject } from "../agents/project-agents.js";
import {
  loadMergedCatalog,
  userCatalogRoot,
} from "../catalog/load.js";
import { arkCacheRoot } from "../fetch/github.js";
import { commandExists } from "../fs/command-exists.js";

const DOCTOR_TOOLS = [
  "composer",
  "uv",
  "poetry",
  "ddev",
  "docker",
  "laravel",
  "symfony",
  "go",
  "flutter",
  "dart",
  "cargo",
  "cookiecutter",
  "django-admin",
  "python3",
  "python",
  "curl",
] as const;

export type DoctorReport = {
  ok: boolean;
  node: { version: string; ok: boolean };
  userCatalog: { path: string; exists: boolean; hasRegistry: boolean };
  cache: { path: string; exists: boolean; entries: number };
  tools: Array<{ name: string; found: boolean }>;
  project?: {
    path: string;
    architectureId: string;
    architectureResolved: boolean;
  };
  issues: string[];
};

function countCacheEntries(cacheRoot: string): number {
  if (!existsSync(cacheRoot)) return 0;
  const github = join(cacheRoot, "github");
  if (!existsSync(github)) return 0;
  let count = 0;
  const walk = (dir: string, depth: number) => {
    if (depth > 5) return;
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (!statSync(abs).isDirectory()) continue;
      if (name === "_repo" && existsSync(join(abs, ".ark-ok"))) {
        count += 1;
        continue;
      }
      walk(abs, depth + 1);
    }
  };
  walk(github, 0);
  return count;
}

export function runDoctor(options: {
  dir?: string;
  catalog?: string;
  strict?: boolean;
}): DoctorReport {
  const issues: string[] = [];
  const nodeVersion = process.versions.node;
  const major = Number(nodeVersion.split(".")[0] ?? 0);
  const nodeOk = major >= 20;
  if (!nodeOk) {
    issues.push(`Node ${nodeVersion} < 20`);
  }

  const catalogPath = options.catalog
    ? resolve(options.catalog)
    : userCatalogRoot();
  const hasRegistry = existsSync(join(catalogPath, "registry.yaml"));
  const catalogExists = existsSync(catalogPath);

  const cachePath = arkCacheRoot();
  const cacheExists = existsSync(cachePath);
  const entries = countCacheEntries(cachePath);

  const tools = DOCTOR_TOOLS.map((name) => ({
    name,
    found: commandExists(name),
  }));

  let project: DoctorReport["project"];
  if (options.dir) {
    const projectRoot = resolve(options.dir);
    try {
      const projectFile = loadArkProject(projectRoot);
      const catalog = loadMergedCatalog({
        userRoot: options.catalog ? resolve(options.catalog) : userCatalogRoot(),
      });
      const archId = projectFile.implements.architecture;
      const resolved = catalog.registry.architectures.some(
        (a) => a.id === archId,
      );
      if (!resolved) {
        issues.push(`Architecture "${archId}" not in catalog`);
      }
      project = {
        path: projectRoot,
        architectureId: archId,
        architectureResolved: resolved,
      };

      if (options.strict) {
        const stacks = detectStacks(projectRoot).tags;
        const needed: string[] = [];
        if (stacks.includes("laravel") || stacks.includes("php")) {
          needed.push("composer");
        }
        if (stacks.includes("django") || stacks.includes("fastapi") || stacks.includes("python")) {
          if (!commandExists("uv") && !commandExists("poetry") && !commandExists("python3") && !commandExists("python")) {
            issues.push("No Python toolchain found (uv/poetry/python3)");
          }
        }
        for (const tool of needed) {
          if (!commandExists(tool)) {
            issues.push(`Missing tool for detected stack: ${tool}`);
          }
        }
      }
    } catch (error) {
      if (options.strict) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const ok = issues.length === 0;
  return {
    ok,
    node: { version: nodeVersion, ok: nodeOk },
    userCatalog: {
      path: catalogPath,
      exists: catalogExists,
      hasRegistry,
    },
    cache: { path: cachePath, exists: cacheExists, entries },
    tools,
    project,
    issues,
  };
}

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Diagnose cache, user catalog, and bootstrap tools",
  },
  args: {
    dir: {
      type: "string",
      description: "Optional project directory with ark.project.yaml",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    json: {
      type: "boolean",
      description: "Emit JSON report",
      default: false,
    },
    strict: {
      type: "boolean",
      description: "Exit 1 when issues are found",
      default: false,
    },
  },
  async run({ args }) {
    const report = runDoctor({
      dir: args.dir ? String(args.dir) : undefined,
      catalog: args.catalog ? String(args.catalog) : undefined,
      strict: Boolean(args.strict),
    });

    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      if (args.strict && !report.ok) process.exit(1);
      return;
    }

    p.intro("arkctl doctor");
    p.log.info(
      `Node ${report.node.version} ${report.node.ok ? "(ok)" : "(need >= 20)"}`,
    );
    p.log.info(
      `User catalog: ${report.userCatalog.path}` +
        (report.userCatalog.hasRegistry
          ? " (registry.yaml present)"
          : report.userCatalog.exists
            ? " (empty user catalog, ok)"
            : " (missing, ok)"),
    );
    p.log.info(
      `Cache: ${report.cache.path}` +
        (report.cache.exists
          ? ` (${report.cache.entries} repo entr${report.cache.entries === 1 ? "y" : "ies"})`
          : " (empty)"),
    );

    for (const tool of report.tools) {
      if (tool.found) {
        p.log.success(`${tool.name}`);
      } else {
        p.log.warn(`${tool.name} (not found)`);
      }
    }

    if (report.project) {
      p.log.info(
        `Project ${report.project.path}: architecture "${report.project.architectureId}"` +
          (report.project.architectureResolved ? " (resolved)" : " (MISSING)"),
      );
    }

    if (report.issues.length) {
      for (const issue of report.issues) {
        p.log.error(issue);
      }
      p.outro(`${report.issues.length} issue(s)`);
      if (args.strict) process.exit(1);
      return;
    }

    p.outro("Healthy");
  },
});
