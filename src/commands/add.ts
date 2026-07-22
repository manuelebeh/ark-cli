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
  installAgentsIntoProject,
  loadArkProject,
  postInstallTipLines,
  shortDescription,
} from "../agents/project-agents.js";
import {
  loadMergedCatalog,
  readYamlFile,
  userCatalogRoot,
} from "../catalog/load.js";
import { resolvePackRoot } from "../catalog/resolve-pack.js";
import type { ProjectManifest, Registry } from "../types.js";
import {
  addArchitectureCommand,
  addProjectCommand,
} from "./add-packs.js";

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

export const addAgentCommand = defineCommand({
  meta: {
    name: "agent",
    description: "Install catalog agents into an existing Ark project",
  },
  args: {
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
      description: "Project directory (default: .)",
      alias: "d",
      default: ".",
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
    p.intro("ark add agent");

    const projectRoot = resolve(String(args.dir ?? "."));
    if (!existsSync(join(projectRoot, "ark.project.yaml"))) {
      p.cancel(`No ark.project.yaml in ${projectRoot}`);
      process.exit(1);
    }

    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();
    const catalog = loadMergedCatalog({ userRoot });
    const { registry } = catalog;

    let projectFile;
    try {
      projectFile = loadArkProject(projectRoot);
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const existingIds = projectFile.agents ?? [];
    const projectId = projectFile.project.id;
    const projectEntry = registry.projects.find((proj) => proj.id === projectId);
    if (!projectEntry) {
      p.cancel(
        `Unknown project type "${projectId}" in ark.project.yaml. Is the catalog up to date?`,
      );
      process.exit(1);
    }

    let projectPackRoot: string;
    try {
      projectPackRoot = await resolvePackRoot(
        projectEntry,
        catalog.rootFor("project", projectEntry.id),
      );
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

    p.log.info(`Project: ${projectFile.project.name} (${projectId})`);
    p.log.info(`Stacks: ${stacks.join(", ") || "(none)"}`);
    if (existingIds.length) {
      p.log.info(
        `Already installed: ${formatAgentLabels(registry.agents, existingIds)}`,
      );
    }

    const compatible = filterAgentsForStacks(registry.agents, stacks).filter(
      (a) => !existingIds.includes(a.id),
    );
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
      try {
        const expanded = expandPresetAgents(registry, presetIds);
        presetAgentIds = expanded.agentIds.filter(
          (id) => !existingIds.includes(id),
        );
        presetNotes = expanded.notes;
        const skipped = expanded.agentIds.filter((id) =>
          existingIds.includes(id),
        );
        if (presetAgentIds.length) {
          p.log.info(
            `Preset agents: ${formatAgentLabels(registry.agents, presetAgentIds)}`,
          );
        }
        if (skipped.length) {
          p.log.info(
            `Already present (skipped): ${formatAgentLabels(registry.agents, skipped)}`,
          );
        }
      } catch (error) {
        p.cancel(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }

    let extraAgentIds: string[] = args.agents
      ? String(args.agents)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const presetFromCli = Boolean(args.preset);
    if (!args.agents && !presetFromCli) {
      const remaining = compatible.filter(
        (a) => !presetAgentIds.includes(a.id),
      );
      if (remaining.length === 0) {
        if (!presetAgentIds.length) {
          p.log.warn(
            existingIds.length
              ? "No additional agents match this project stack"
              : "No agents match this project stack",
          );
        }
      } else {
        const selectedAgents = await p.multiselect({
          message: presetAgentIds.length
            ? "Additional agents (optional)"
            : "Agents to add (remote packs are downloaded on select)",
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

    if (args.agents) {
      const unknown = extraAgentIds.filter(
        (id) => !registry.agents.some((a) => a.id === id),
      );
      if (unknown.length) {
        p.cancel(`Unknown agent(s): ${unknown.join(", ")}`);
        process.exit(1);
      }
      const already = extraAgentIds.filter((id) => existingIds.includes(id));
      if (already.length) {
        p.log.info(
          `Already present (skipped): ${formatAgentLabels(registry.agents, already)}`,
        );
      }
      extraAgentIds = extraAgentIds.filter((id) => !existingIds.includes(id));
    }

    const toAdd = mergeAgentIds(presetAgentIds, extraAgentIds);
    if (!toAdd.length) {
      p.outro("Nothing to add");
      return;
    }

    warnExclusiveGroups(registry, mergeAgentIds(existingIds, toAdd));

    const spinner = p.spinner();
    spinner.start(
      toAdd.some(
        (id) => registry.agents.find((a) => a.id === id)?.source === "github",
      )
        ? "Downloading + installing agents"
        : "Installing agents",
    );

    try {
      const result = await installAgentsIntoProject({
        projectRoot,
        agentIds: toAdd,
        catalog,
        mergeWithExisting: true,
        runPostInstall: Boolean(args["run-postinstall"]),
        runPostInstallFor: toAdd,
        postInstallNotes: presetNotes,
      });
      spinner.stop(
        `Added ${result.addedIds.length} agent${result.addedIds.length === 1 ? "" : "s"}`,
      );
      for (const line of postInstallTipLines({
        postInstall: result.postInstall,
        notes: presetNotes,
        ran: Boolean(args["run-postinstall"]),
        flagHint: "ark add agent --run-postinstall",
      })) {
        p.log.info(line);
      }
      p.outro(
        `Agents in project: ${formatAgentLabels(registry.agents, result.agentIds)}`,
      );
    } catch (error) {
      spinner.stop("Failed");
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add packs to the user catalog, or agents to a project",
  },
  subCommands: {
    project: addProjectCommand,
    architecture: addArchitectureCommand,
    agent: addAgentCommand,
  },
});
