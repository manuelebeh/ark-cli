import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import {
  loadArkProject,
} from "../agents/project-agents.js";
import { uninstallAgentsFromProject } from "../agents/uninstall.js";
import {
  loadMergedCatalog,
  userCatalogRoot,
} from "../catalog/load.js";
import { canPrompt, exitIfCancelled, requireInteractive } from "../cli/prompts.js";

const removeAgentCommand = defineCommand({
  meta: {
    name: "agent",
    description: "Remove installed agent packs from a project",
  },
  args: {
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
  },
  async run({ args }) {
    const projectRoot = resolve(String(args.dir ?? "."));
    p.intro(`ark remove agent → ${projectRoot}`);

    let projectFile;
    try {
      projectFile = loadArkProject(projectRoot);
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const installed = projectFile.agents ?? [];
    if (installed.length === 0) {
      p.log.warn("No agents installed");
      p.outro("Nothing to remove");
      return;
    }

    let toRemove = args.agents
      ? String(args.agents)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (toRemove.length === 0) {
      if (!canPrompt()) {
        requireInteractive("--agents");
      }
      const selected = await p.multiselect({
        message: "Agents to remove",
        options: installed.map((id) => ({ value: id, label: id })),
        required: true,
      });
      exitIfCancelled(selected);
      toRemove = selected as string[];
    }

    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();
    const catalog = loadMergedCatalog({ userRoot });

    try {
      const result = await uninstallAgentsFromProject({
        projectRoot,
        agentIds: toRemove,
        catalog,
      });
      p.log.success(`Removed: ${result.removedIds.join(", ")}`);
      if (result.remainingIds.length) {
        p.log.info(`Remaining: ${result.remainingIds.join(", ")}`);
      }
      p.outro("Done");
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});

export const removeCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove catalog packs from a project",
  },
  subCommands: {
    agent: removeAgentCommand,
  },
});
