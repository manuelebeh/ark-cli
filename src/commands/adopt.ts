import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  arkProjectPath,
  writeArkProject,
} from "../agents/project-agents.js";
import {
  defaultProjectName,
  detectStacks,
  scoreArchitectures,
} from "../adopt/detect.js";
import {
  loadMergedCatalog,
  readYamlFile,
  userCatalogRoot,
} from "../catalog/load.js";
import { resolvePackRoot } from "../catalog/resolve-pack.js";
import { checkProject } from "../check/engine.js";
import {
  formatCheckJson,
  summarizeIssues,
} from "../check/report.js";
import {
  canPrompt,
  exitIfCancelled,
  requireInteractive,
} from "../cli/prompts.js";
import type { ArchitectureManifest, ArkProjectFile } from "../types.js";

export const adoptCommand = defineCommand({
  meta: {
    name: "adopt",
    description:
      "Detect layout on an existing repo, write ark.project.yaml, then check",
  },
  args: {
    path: {
      type: "positional",
      description: "Project path (default: .)",
      required: false,
      default: ".",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    architecture: {
      type: "string",
      description: "Architecture id (skip detection)",
      alias: "arch",
    },
    project: {
      type: "string",
      description: "Project type id (default: best match for architecture)",
    },
    name: {
      type: "string",
      description: "Project name in ark.project.yaml (default: directory name)",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing ark.project.yaml",
      default: false,
    },
    json: {
      type: "boolean",
      description: "Emit check result as JSON",
      default: false,
    },
    yes: {
      type: "boolean",
      description: "Accept best detection match without prompting",
      alias: "y",
      default: false,
    },
  },
  async run({ args }) {
    const root = resolve(args.path);
    const machine = Boolean(args.json);

    if (!machine) {
      p.intro(`arkctl adopt → ${root}`);
    }

    if (!existsSync(root)) {
      const msg = `Path not found: ${root}`;
      if (machine) console.error(msg);
      else p.cancel(msg);
      process.exit(1);
    }

    const projectFilePath = arkProjectPath(root);
    if (existsSync(projectFilePath) && !args.force) {
      const msg =
        "ark.project.yaml already exists (pass --force to overwrite)";
      if (machine) console.error(msg);
      else p.cancel(msg);
      process.exit(1);
    }

    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();
    const catalog = loadMergedCatalog({ userRoot });
    const { registry } = catalog;

    const detection = detectStacks(root);
    if (!machine) {
      p.log.info(
        detection.tags.length
          ? `Detected stacks: ${detection.tags.join(", ")} (${detection.signals.join(", ")})`
          : "No stack fingerprints found; scoring all architectures",
      );
    }

    let architectureId = args.architecture
      ? String(args.architecture)
      : undefined;
    let projectId = args.project ? String(args.project) : undefined;

    const scores = await scoreArchitectures(root, catalog, detection.tags);

    if (!architectureId) {
      const best = scores[0];
      const second = scores[1];
      const tied =
        best && second && best.score === second.score && best.score > 0;
      const weak = !best || best.score <= 0;

      if (args.yes && best && !weak) {
        architectureId = best.architectureId;
        projectId = projectId ?? best.projectId;
      } else if (!weak && !tied && (args.yes || !canPrompt())) {
        if (!args.yes && !canPrompt()) {
          requireInteractive("--architecture / --yes");
        }
        architectureId = best!.architectureId;
        projectId = projectId ?? best!.projectId;
      } else if (canPrompt() && !machine) {
        const options = scores
          .filter((s) => s.score > -10)
          .slice(0, 12)
          .map((s) => ({
            value: s.architectureId,
            label: s.architectureId,
            hint: `score ${s.score}${s.missingRequired.length ? `; missing ${s.missingRequired.join(", ")}` : ""}`,
          }));
        if (options.length === 0) {
          p.cancel("No architectures available in catalog");
          process.exit(1);
        }
        const selected = await p.select({
          message: "Select architecture",
          options,
          initialValue: best?.architectureId,
        });
        exitIfCancelled(selected);
        architectureId = selected as string;
        const match = scores.find((s) => s.architectureId === architectureId);
        projectId = projectId ?? match?.projectId;
      } else {
        const msg =
          "Could not auto-detect architecture; pass --architecture and --project";
        if (machine) console.error(msg);
        else p.cancel(msg);
        process.exit(1);
      }
    }

    const archEntry = registry.architectures.find(
      (a) => a.id === architectureId,
    );
    if (!archEntry) {
      const msg = `Unknown architecture: ${architectureId}`;
      if (machine) console.error(msg);
      else p.cancel(msg);
      process.exit(1);
    }

    if (!projectId) {
      const candidates = registry.projects.filter(
        (pr) => pr.implements === architectureId,
      );
      if (candidates.length === 1) {
        projectId = candidates[0]!.id;
      } else if (candidates.length > 1 && canPrompt() && !machine && !args.yes) {
        const selected = await p.select({
          message: "Select project type",
          options: candidates.map((pr) => ({
            value: pr.id,
            label: pr.name,
            hint: (pr.stacks ?? []).join(","),
          })),
        });
        exitIfCancelled(selected);
        projectId = selected as string;
      } else if (candidates.length > 0 && (args.yes || !canPrompt())) {
        const scored = scores.find((s) => s.architectureId === architectureId);
        projectId = scored?.projectId ?? candidates[0]!.id;
      } else {
        const msg = `No project type for architecture "${architectureId}"`;
        if (machine) console.error(msg);
        else p.cancel(msg);
        process.exit(1);
      }
    }

    const projectEntry = registry.projects.find((pr) => pr.id === projectId);
    if (!projectEntry) {
      const msg = `Unknown project type: ${projectId}`;
      if (machine) console.error(msg);
      else p.cancel(msg);
      process.exit(1);
    }
    if (projectEntry.implements !== architectureId) {
      const msg = `Project "${projectId}" implements "${projectEntry.implements}", not "${architectureId}"`;
      if (machine) console.error(msg);
      else p.cancel(msg);
      process.exit(1);
    }

    const archDir = await resolvePackRoot(
      archEntry,
      catalog.rootFor("architecture", archEntry.id),
    );
    const archManifest = readYamlFile<ArchitectureManifest>(
      join(archDir, "manifest.yaml"),
    );

    const name = defaultProjectName(
      root,
      args.name ? String(args.name) : undefined,
    );
    const arkProject: ArkProjectFile = {
      schema_version: 1,
      implements: {
        architecture: architectureId!,
        architecture_version: archManifest.version,
      },
      project: {
        id: projectId!,
        name,
      },
      agents: [],
    };
    writeArkProject(root, arkProject);

    const layoutPath = join(archDir, archManifest.files.layout);
    const archMd = join(root, "ARCHITECTURE.md");
    if (!existsSync(archMd) && existsSync(layoutPath)) {
      writeFileSync(archMd, readFileSync(layoutPath, "utf8"), "utf8");
    }

    if (!machine) {
      p.log.success(
        `Wrote ark.project.yaml (${architectureId} / ${projectId}, name=${name})`,
      );
    }

    const result = await checkProject(root, { catalog, userCatalogRoot: userRoot });
    const { errors, warnings } = summarizeIssues(result.issues);

    if (machine) {
      process.stdout.write(formatCheckJson(result));
      if (errors > 0) process.exit(1);
      return;
    }

    if (result.issues.length === 0) {
      p.log.success(`OK: architecture "${result.architectureId}"`);
      p.outro("Adopted");
      return;
    }

    for (const issue of result.issues) {
      const label = issue.path
        ? `${issue.path}: ${issue.message}`
        : issue.message;
      if (issue.severity === "error") {
        p.log.error(`[${issue.code}] ${label}`);
      } else {
        p.log.warn(`[${issue.code}] ${label}`);
      }
    }
    p.outro(
      `${errors} error(s), ${warnings} warning(s) (${result.architectureId})`,
    );
    if (errors > 0) process.exit(1);
  },
});
