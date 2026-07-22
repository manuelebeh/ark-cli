import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { filterAgentsForStacks, resolveProjectStacks } from "../agents/filter.js";
import {
  expandPresetAgents,
  listPresets,
  mergeAgentIds,
} from "../agents/presets.js";
import {
  formatAgentLabels,
  postInstallTipLines,
  shortDescription,
} from "../agents/project-agents.js";
import {
  loadMergedCatalog,
  readYamlFile,
  userCatalogRoot,
} from "../catalog/load.js";
import { createProject } from "../create/scaffold.js";
import { fetchGithubSource, parseGithubSource } from "../fetch/github.js";
import type { ProjectManifest, Registry } from "../types.js";

function warnExclusiveGroups(registry: Registry, agentIds: string[]): void {
  const selectedEntries = agentIds
    .map((id) => registry.agents.find((a) => a.id === id))
    .filter(Boolean);
  const groups = new Map<string, string[]>();
  for (const agent of selectedEntries) {
    if (!agent?.exclusive_group) continue;
    const list = groups.get(agent.exclusive_group) ?? [];
    list.push(agent.id);
    groups.set(agent.exclusive_group, list);
  }
  for (const [group, ids] of groups) {
    if (ids.length > 1) {
      p.log.warn(
        `Exclusive group "${group}" has multiple agents selected (${ids.join(", ")}). They overlap; consider keeping one.`,
      );
    }
  }
}

export const createCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a new project from the catalog",
  },
  args: {
    name: {
      type: "positional",
      description: "Project directory / name",
      required: false,
    },
    project: {
      type: "string",
      description: "Project type id (skips prompt)",
      alias: "p",
    },
    architecture: {
      type: "string",
      description: "Architecture id (skips prompt; filters project types)",
    },
    arch: {
      type: "string",
      description: "Alias for --architecture",
    },
    preset: {
      type: "string",
      description: "Comma-separated preset ids (e.g. matt-pocock-core)",
    },
    agents: {
      type: "string",
      description: "Comma-separated agent ids",
      alias: "a",
    },
    dir: {
      type: "string",
      description: "Target directory (default: ./<name>)",
      alias: "d",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    "run-postinstall": {
      type: "boolean",
      description: "Run tool-skill post-install commands (e.g. react-doctor)",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("ark create");

    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();
    const catalog = loadMergedCatalog({ userRoot });
    const { registry } = catalog;

    let name = args.name;
    if (!name) {
      const answered = await p.text({
        message: "Project name",
        placeholder: "my-app",
        validate: (v) => (!v ? "Name is required" : undefined),
      });
      if (p.isCancel(answered)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      name = answered;
    }

    const archFromFlag =
      (args.architecture as string | undefined) ??
      (args.arch as string | undefined);
    let projectId = args.project as string | undefined;
    let architectureId = archFromFlag;

    if (projectId && architectureId) {
      const entry = registry.projects.find((proj) => proj.id === projectId);
      if (entry && entry.implements !== architectureId) {
        p.cancel(
          `Project "${projectId}" implements "${entry.implements}", not "${architectureId}"`,
        );
        process.exit(1);
      }
    }

    if (projectId && !architectureId) {
      const entry = registry.projects.find((proj) => proj.id === projectId);
      if (!entry) {
        p.cancel(`Unknown project type: ${projectId}`);
        process.exit(1);
      }
      architectureId = entry.implements;
    }

    if (!architectureId) {
      const selected = await p.select({
        message: "Architecture",
        options: registry.architectures.map((arch) => ({
          value: arch.id,
          label: `${arch.name} (${arch.id})`,
          hint: arch.source === "github" ? "github" : undefined,
        })),
      });
      if (p.isCancel(selected)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      architectureId = selected as string;
    }

    const archEntry = registry.architectures.find(
      (arch) => arch.id === architectureId,
    );
    if (!archEntry) {
      p.cancel(`Unknown architecture: ${architectureId}`);
      process.exit(1);
    }

    p.log.info(`Architecture: ${archEntry.name} (${archEntry.id})`);

    const projectsForArch = registry.projects.filter(
      (proj) => proj.implements === architectureId,
    );
    if (projectsForArch.length === 0) {
      p.cancel(
        `No project types implement architecture "${architectureId}". Add one with ark add project.`,
      );
      process.exit(1);
    }

    if (!projectId) {
      const selected = await p.select({
        message: "Project type",
        options: projectsForArch.map((proj) => ({
          value: proj.id,
          label: `${proj.name} (${proj.id})`,
          hint: proj.source === "github" ? "github" : undefined,
        })),
      });
      if (p.isCancel(selected)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      projectId = selected as string;
    }

    const projectEntry = registry.projects.find((proj) => proj.id === projectId);
    if (!projectEntry) {
      p.cancel(`Unknown project type: ${projectId}`);
      process.exit(1);
    }
    if (projectEntry.implements !== architectureId) {
      p.cancel(
        `Project "${projectId}" implements "${projectEntry.implements}", not "${architectureId}"`,
      );
      process.exit(1);
    }

    let projectPackRoot: string;
    try {
      if (projectEntry.source === "github") {
        if (!projectEntry.github) {
          throw new Error(`Project ${projectEntry.id} missing github locator`);
        }
        projectPackRoot = await fetchGithubSource(
          parseGithubSource(projectEntry.github),
        );
      } else {
        if (!projectEntry.path) {
          throw new Error(`Project ${projectEntry.id} missing path`);
        }
        projectPackRoot = join(
          catalog.rootFor("project", projectEntry.id),
          projectEntry.path,
        );
      }
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const projectManifest = readYamlFile<ProjectManifest>(
      join(projectPackRoot, "manifest.yaml"),
    );
    const stacks = resolveProjectStacks({
      registryStacks: projectEntry.stacks,
      manifestTags: projectManifest.stack.tags,
    });

    p.log.info(`Stacks: ${stacks.join(", ") || "(none)"}`);

    const compatible = filterAgentsForStacks(registry.agents, stacks);
    const presets = listPresets(registry);

    let presetIds: string[] = args.preset
      ? String(args.preset).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!args.preset && !args.agents && presets.length > 0) {
      const selectedPreset = await p.select({
        message: "Agent preset (optional)",
        options: [
          { value: "", label: "None (pick agents individually)" },
          ...presets.map((preset) => ({
            value: preset.id,
            label: `${preset.name} (${preset.id})`,
            hint:
              shortDescription(preset.description) ??
              `${preset.agents.length} agents`,
          })),
        ],
      });
      if (p.isCancel(selectedPreset)) {
        p.cancel("Cancelled");
        process.exit(0);
      }
      if (selectedPreset) presetIds = [selectedPreset as string];
    }

    let presetAgentIds: string[] = [];
    let presetNotes: string[] = [];
    if (presetIds.length) {
      const expanded = expandPresetAgents(registry, presetIds);
      presetAgentIds = expanded.agentIds;
      presetNotes = expanded.notes;
      p.log.info(
        `Preset agents: ${formatAgentLabels(registry.agents, presetAgentIds)}`,
      );
    }

    let extraAgentIds: string[] = args.agents
      ? String(args.agents).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // CLI --preset alone = use that set; only prompt for extras in interactive flows.
    const presetFromCli = Boolean(args.preset);
    if (!args.agents && !presetFromCli) {
      const remaining = compatible.filter((a) => !presetAgentIds.includes(a.id));
      if (remaining.length === 0) {
        if (!presetAgentIds.length) p.log.warn("No agents match this project stack");
      } else {
        const selectedAgents = await p.multiselect({
          message: presetAgentIds.length
            ? "Additional agents (optional)"
            : "Agents to include (remote packs are downloaded on select)",
          options: remaining.map((agent) => ({
            value: agent.id,
            label: `${agent.name} (${agent.id})`,
            hint: [
              agent.kind,
              agent.source === "github" ? "github" : null,
              agent.group ?? null,
              agent.exclusive_group ? `group:${agent.exclusive_group}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          })),
          required: false,
        });
        if (p.isCancel(selectedAgents)) {
          p.cancel("Cancelled");
          process.exit(0);
        }
        extraAgentIds = selectedAgents as string[];
      }
    }

    const agentIds = mergeAgentIds(presetAgentIds, extraAgentIds);
    warnExclusiveGroups(registry, agentIds);

    const targetDir = resolve((args.dir as string | undefined) ?? `./${name}`);
    if (existsSync(targetDir)) {
      p.cancel(`Target already exists: ${targetDir}`);
      process.exit(1);
    }

    const spinner = p.spinner();
    spinner.start(
      agentIds.some((id) => registry.agents.find((a) => a.id === id)?.source === "github") ||
        projectEntry.source === "github"
        ? "Downloading + scaffolding"
        : "Scaffolding project",
    );
    try {
      const result = await createProject({
        name: String(name),
        targetDir,
        projectId,
        agentIds,
        catalog,
        userCatalogRoot: userRoot,
        runPostInstall: Boolean(args["run-postinstall"]),
        postInstallNotes: presetNotes,
      });
      spinner.stop("Project created");
      for (const line of postInstallTipLines({
        postInstall: result.postInstall,
        notes: presetNotes,
        ran: Boolean(args["run-postinstall"]),
        flagHint: "ark create --run-postinstall",
      })) {
        p.log.info(line);
      }
    } catch (error) {
      spinner.stop("Failed");
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    p.outro(`Ready at ${targetDir}\n  Next: cd ${name} && ark check`);
  },
});
