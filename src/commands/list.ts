import { defineCommand } from "citty";
import { filterAgentsForStacks } from "../agents/filter.js";
import { listPresets } from "../agents/presets.js";
import { shortDescription } from "../agents/project-agents.js";
import { loadMergedCatalog, userCatalogRoot } from "../catalog/load.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List architectures, project types, presets, and agents",
  },
  args: {
    stack: {
      type: "string",
      description: "Filter agents by stack tag(s), comma-separated",
      alias: "s",
    },
    group: {
      type: "string",
      description: "Filter agents by group (e.g. matt-pocock)",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
  },
  run({ args }) {
    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();
    const { registry, userRoot: loadedUser } = loadMergedCatalog({
      userRoot,
    });
    console.log(`Catalog: ${registry.name} v${registry.version}`);
    if (loadedUser) {
      console.log(`User catalog: ${loadedUser}`);
    }
    console.log("");

    console.log("Architectures");
    for (const arch of registry.architectures) {
      const origin =
        arch.source === "github"
          ? arch.github ?? "github"
          : arch.path ?? "local";
      console.log(
        `  - ${arch.id}\t${arch.name}\t${arch.source}\t${origin}\tv${arch.version}`,
      );
    }

    console.log("\nProjects");
    for (const project of registry.projects) {
      const stacks = project.stacks?.join(",") ?? "-";
      const origin =
        project.source === "github"
          ? project.github ?? "github"
          : project.path ?? "local";
      console.log(
        `  - ${project.id}\t${project.name}\tarch:${project.implements}\tstacks:${stacks}\t${project.source}\t${origin}\tv${project.version}`,
      );
    }

    const presets = listPresets(registry);
    if (presets.length) {
      console.log("\nPresets");
      for (const preset of presets) {
        const desc = shortDescription(preset.description, 60);
        console.log(
          `  - ${preset.id}\t${preset.name}\t${preset.agents.length} agents${desc ? `\t${desc}` : ""}`,
        );
      }
    }

    const stackFilter = args.stack
      ? String(args.stack).split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    let agents = stackFilter
      ? filterAgentsForStacks(registry.agents, stackFilter)
      : registry.agents;

    if (args.group) {
      const group = String(args.group);
      agents = agents.filter((a) => a.group === group);
    }

    const label = [
      stackFilter ? `stacks: ${stackFilter.join(", ")}` : null,
      args.group ? `group: ${args.group}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    console.log(label ? `\nAgents (${label})` : "\nAgents");
    for (const agent of agents) {
      const origin = agent.source === "github" ? agent.github : agent.path;
      console.log(
        `  - ${agent.id}\t${agent.name}\t${agent.kind}\t${agent.source}\t${origin ?? ""}\tv${agent.version}`,
      );
    }
  },
});
