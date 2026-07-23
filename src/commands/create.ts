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
import {
  canPrompt,
  exitIfCancelled,
  requireInteractive,
} from "../cli/prompts.js";
import {
  isLaravelStack,
  LARAVEL_BOOTSTRAP_OPTIONS,
  parseLaravelBootstrap,
  parseLaravelDepth,
  type LaravelBootstrapMethod,
  type LaravelDepth,
} from "../create/laravel-bootstrap.js";
import { createProject } from "../create/scaffold.js";
import {
  findStackGroup,
  formatStackTags,
  listStackGroups,
  resolveProjectInGroup,
} from "../create/stacks.js";
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
      description: "Project type id (skips stack/architecture prompts)",
      alias: "p",
    },
    stack: {
      type: "string",
      description:
        "Stack tags for the project family, comma-separated (e.g. lib,typescript)",
      alias: "s",
    },
    architecture: {
      type: "string",
      description:
        "Architecture id (skips prompt; with --stack resolves the project type)",
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
    depth: {
      type: "string",
      description:
        "Laravel only: minimal (Ark skeleton) or full (bootstrap a real Laravel app)",
    },
    bootstrap: {
      type: "string",
      description:
        "Laravel full only: laravel-installer | composer | sail | ddev",
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
      requireInteractive("a project name (positional)");
      const answered = await p.text({
        message: "Project name",
        placeholder: "my-app",
        validate: (v) => (!v ? "Name is required" : undefined),
      });
      exitIfCancelled(answered);
      name = answered as string;
    }

    const archFromFlag =
      (args.architecture as string | undefined) ??
      (args.arch as string | undefined);
    const stackFromFlag = args.stack
      ? String(args.stack)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    let projectId = args.project as string | undefined;
    let architectureId = archFromFlag;

    const stackGroups = listStackGroups(registry.projects);
    if (stackGroups.length === 0) {
      p.cancel("No project types in catalog. Add one with ark add project.");
      process.exit(1);
    }

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

    let stackGroup =
      stackFromFlag && !projectId
        ? findStackGroup(stackGroups, stackFromFlag)
        : undefined;

    if (stackFromFlag && !projectId && !stackGroup) {
      const available = stackGroups
        .map((g) => formatStackTags(g.stacks))
        .join(" | ");
      p.cancel(
        `No project family matches stacks "${stackFromFlag.join(",")}". Available: ${available}`,
      );
      process.exit(1);
    }

    const selectableGroups =
      architectureId && !projectId && !stackGroup
        ? stackGroups.filter((g) =>
            g.projects.some((pr) => pr.implements === architectureId),
          )
        : stackGroups;

    if (
      architectureId &&
      !projectId &&
      !stackGroup &&
      selectableGroups.length === 0
    ) {
      p.cancel(
        `Architecture "${architectureId}" has no project templates in the catalog`,
      );
      process.exit(1);
    }

    if (!projectId && !stackGroup) {
      if (selectableGroups.length === 1) {
        stackGroup = selectableGroups[0];
      } else {
        requireInteractive("--stack / -s (or --project / -p)");
        const selected = await p.select({
          message: "Stack",
          options: selectableGroups.map((group) => {
            const archCount = new Set(
              group.projects.map((pr) => pr.implements),
            ).size;
            return {
              value: group.key,
              label: group.label,
              hint: `${formatStackTags(group.stacks)} · ${archCount} arch`,
            };
          }),
        });
        exitIfCancelled(selected);
        stackGroup = selectableGroups.find((g) => g.key === selected);
      }
      if (!stackGroup) {
        p.cancel("Unknown stack");
        process.exit(1);
      }
    }

    if (!projectId && stackGroup) {
      p.log.info(
        `Stack: ${stackGroup.label} (${formatStackTags(stackGroup.stacks)})`,
      );

      const archOptions = stackGroup.projects.map((proj) => {
        const arch = registry.architectures.find(
          (a) => a.id === proj.implements,
        );
        return {
          value: proj.implements,
          label: arch ? `${arch.name} (${arch.id})` : proj.implements,
          hint: proj.id,
        };
      });

      if (architectureId) {
        const match = resolveProjectInGroup(stackGroup, architectureId);
        if (!match) {
          const available = archOptions.map((o) => o.value).join(", ");
          p.cancel(
            `Architecture "${architectureId}" has no template for this stack. Available: ${available}`,
          );
          process.exit(1);
        }
        projectId = match.id;
      } else if (archOptions.length === 1) {
        architectureId = archOptions[0]!.value;
        projectId = resolveProjectInGroup(stackGroup, architectureId)?.id;
      } else {
        requireInteractive("--architecture / --arch");
        const selected = await p.select({
          message: "Architecture",
          options: archOptions,
        });
        exitIfCancelled(selected);
        architectureId = selected as string;
        projectId = resolveProjectInGroup(stackGroup, architectureId)?.id;
      }
    }

    if (!architectureId) {
      p.cancel("Architecture is required");
      process.exit(1);
    }

    const archEntry = registry.architectures.find(
      (arch) => arch.id === architectureId,
    );
    if (!archEntry) {
      p.cancel(`Unknown architecture: ${architectureId}`);
      process.exit(1);
    }

    if (!projectId) {
      p.cancel(
        `No project type for architecture "${architectureId}" on this stack. Add one with ark add project.`,
      );
      process.exit(1);
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

    p.log.info(`Architecture: ${archEntry.name} (${archEntry.id})`);
    p.log.info(`Project type: ${projectEntry.name} (${projectEntry.id})`);

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

    let depth: LaravelDepth = "minimal";
    let bootstrap: LaravelBootstrapMethod | undefined;

    if (isLaravelStack(stacks)) {
      const depthFromFlag = parseLaravelDepth(args.depth);
      if (depthFromFlag) {
        depth = depthFromFlag;
      } else if (args.depth) {
        p.cancel(`Invalid --depth "${args.depth}" (use minimal or full)`);
        process.exit(1);
      } else {
        requireInteractive("--depth minimal|full");
        const selected = await p.select({
          message: "Depth",
          options: [
            {
              value: "minimal",
              label: "Minimal",
              hint: "Ark architecture skeleton only",
            },
            {
              value: "full",
              label: "Full",
              hint: "Bootstrap a real Laravel app, then apply architecture",
            },
          ],
        });
        exitIfCancelled(selected);
        depth = selected as LaravelDepth;
      }

      if (depth === "full") {
        const bootFromFlag = parseLaravelBootstrap(args.bootstrap);
        if (bootFromFlag) {
          bootstrap = bootFromFlag;
        } else if (args.bootstrap) {
          p.cancel(
            `Invalid --bootstrap "${args.bootstrap}" (use laravel-installer, composer, sail, or ddev)`,
          );
          process.exit(1);
        } else {
          requireInteractive("--bootstrap laravel-installer|composer|sail|ddev");
          const selected = await p.select({
            message: "Laravel bootstrap",
            options: LARAVEL_BOOTSTRAP_OPTIONS,
          });
          exitIfCancelled(selected);
          bootstrap = selected as LaravelBootstrapMethod;
        }
        p.log.info(`Bootstrap: ${bootstrap}`);
      }

      p.log.info(`Depth: ${depth}`);
    }

    const compatible = filterAgentsForStacks(registry.agents, stacks);
    const presets = listPresets(registry);

    let presetIds: string[] = args.preset
      ? String(args.preset).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (!args.preset && !args.agents && presets.length > 0 && canPrompt()) {
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
      exitIfCancelled(selectedPreset);
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
    if (!args.agents && !presetFromCli && canPrompt()) {
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
        exitIfCancelled(selectedAgents);
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
    const initialMessage =
      depth === "full" && bootstrap
        ? `Bootstrapping Laravel (${bootstrap})…`
        : agentIds.some(
              (id) =>
                registry.agents.find((a) => a.id === id)?.source === "github",
            ) || projectEntry.source === "github"
          ? "Downloading + scaffolding"
          : "Scaffolding project";
    spinner.start(initialMessage);
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
        depth,
        bootstrap,
        onProgress: (message) => {
          spinner.message(message);
        },
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
