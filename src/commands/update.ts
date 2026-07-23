import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  installAgentsIntoProject,
  loadArkProject,
} from "../agents/project-agents.js";
import {
  loadMergedCatalog,
  userCatalogRoot,
} from "../catalog/load.js";
import {
  clearArkCache,
  parseGithubSource,
  repoCacheDir,
} from "../fetch/github.js";

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Refresh remote agent + pack cache (~/.ark/cache)",
  },
  args: {
    dir: {
      type: "string",
      description: "Project directory when using --agents (default: .)",
      default: ".",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    agents: {
      type: "boolean",
      description:
        "Re-fetch remote agents listed in ark.project.yaml after clearing their cache entries",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "List cache paths that would be removed",
      default: false,
    },
  },
  async run({ args }) {
    const dryRun = Boolean(args["dry-run"]);
    p.intro(dryRun ? "arkctl update (dry-run)" : "arkctl update");

    if (args.agents) {
      const projectRoot = resolve(String(args.dir));
      if (!existsSync(projectRoot)) {
        p.cancel(`Path not found: ${projectRoot}`);
        process.exit(1);
      }

      let projectFile;
      try {
        projectFile = loadArkProject(projectRoot);
      } catch (error) {
        p.cancel(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      const agentIds = projectFile.agents ?? [];
      if (agentIds.length === 0) {
        p.log.warn("No agents listed in ark.project.yaml");
        p.outro("Nothing to update");
        return;
      }

      const userRoot = args.catalog
        ? String(args.catalog)
        : userCatalogRoot();
      const catalog = loadMergedCatalog({ userRoot });
      const removed: string[] = [];

      for (const id of agentIds) {
        const agent = catalog.registry.agents.find((a) => a.id === id);
        if (!agent?.github) continue;
        const source = parseGithubSource(agent.github);
        const cachePath = repoCacheDir(source);
        if (existsSync(cachePath)) {
          removed.push(cachePath);
          if (!dryRun) {
            clearArkCache(
              {
                owner: source.owner,
                repo: source.repo,
                ref: source.ref,
              },
              { dryRun: false },
            );
          }
        }
      }

      if (dryRun) {
        for (const path of removed) {
          p.log.info(`would remove ${path}`);
        }
        p.log.info(`would reinstall agents: ${agentIds.join(", ")}`);
        p.outro(`${removed.length} cache path(s)`);
        return;
      }

      await installAgentsIntoProject({
        projectRoot,
        agentIds,
        catalog,
        mergeWithExisting: false,
      });

      p.log.success(
        `Cleared ${removed.length} cache path(s); reinstalled ${agentIds.length} agent(s)`,
      );
      p.outro("Updated");
      return;
    }

    const result = clearArkCache({}, { dryRun });
    if (result.removed.length === 0) {
      p.log.info(`Cache empty or missing: ${result.root}`);
      p.outro("Nothing to clear");
      return;
    }

    for (const path of result.removed) {
      p.log.info(`${dryRun ? "would remove" : "removed"} ${path}`);
    }
    p.outro(
      dryRun
        ? `${result.removed.length} path(s) would be cleared`
        : `Cleared ${result.removed.length} path(s)`,
    );
  },
});
