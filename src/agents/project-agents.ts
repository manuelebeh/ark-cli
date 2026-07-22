import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  readYamlFile,
  type LoadedCatalog,
} from "../catalog/load.js";
import type { AgentEntry, ArkProjectFile } from "../types.js";
import { installAgent, writeAgentsIndex, type InstalledAgent } from "./install.js";
import { mergeAgentIds } from "./presets.js";

export function arkProjectPath(projectRoot: string): string {
  return join(projectRoot, "ark.project.yaml");
}

export function loadArkProject(projectRoot: string): ArkProjectFile {
  const path = arkProjectPath(projectRoot);
  if (!existsSync(path)) {
    throw new Error(`No ark.project.yaml found in ${projectRoot}`);
  }
  return readYamlFile<ArkProjectFile>(path);
}

export function writeArkProject(
  projectRoot: string,
  project: ArkProjectFile,
): void {
  writeFileSync(
    arkProjectPath(projectRoot),
    stringifyYaml(project, { lineWidth: 0 }),
    "utf8",
  );
}

export function formatAgentLabel(
  agent: Pick<AgentEntry, "id" | "name">,
): string {
  return `${agent.name} (${agent.id})`;
}

export function formatAgentLabels(
  registryAgents: AgentEntry[],
  agentIds: string[],
): string {
  return agentIds
    .map((id) => {
      const agent = registryAgents.find((a) => a.id === id);
      return agent ? formatAgentLabel(agent) : id;
    })
    .join(", ");
}

/** First line of description, truncated for list/select hints. */
export function shortDescription(
  text: string | undefined,
  max = 72,
): string | undefined {
  if (!text) return undefined;
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return undefined;
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function postInstallTipLines(opts: {
  postInstall: string[];
  notes: string[];
  ran: boolean;
  flagHint: string;
}): string[] {
  if (!opts.postInstall.length && !opts.notes.length) return [];
  if (opts.ran) {
    return opts.notes.length
      ? ["Preset notes are in .agents/POSTINSTALL.md"]
      : [];
  }
  return [
    "See .agents/POSTINSTALL.md for next steps",
    `Or re-run with ${opts.flagHint} to execute post-install commands`,
  ];
}

export function runPostInstallCommands(
  projectRoot: string,
  commands: string[],
): void {
  for (const cmd of commands) {
    const result = spawnSync(cmd, {
      cwd: projectRoot,
      shell: true,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`Post-install failed: ${cmd}`);
    }
  }
}

export type InstallAgentsOptions = {
  projectRoot: string;
  /** Full agent id list to persist and reinstall. */
  agentIds: string[];
  catalog: LoadedCatalog;
  runPostInstall?: boolean;
  /** When set, only these agents' post commands are executed (add agent). */
  runPostInstallFor?: string[];
  postInstallNotes?: string[];
  /** When true, merge agentIds into existing ark.project.yaml agents. */
  mergeWithExisting?: boolean;
};

export type InstallAgentsResult = {
  /** All post-install commands across installed agents (for docs / tips). */
  postInstall: string[];
  /** Commands actually executed when runPostInstall is true. */
  ranPostInstall: string[];
  /** Agents newly added when mergeWithExisting was true. */
  addedIds: string[];
  agentIds: string[];
  installed: InstalledAgent[];
};

export async function installAgentsIntoProject(
  options: InstallAgentsOptions,
): Promise<InstallAgentsResult> {
  const { catalog } = options;
  const { registry } = catalog;

  let existingIds: string[] = [];
  let projectFile: ArkProjectFile | null = null;

  if (options.mergeWithExisting || existsSync(arkProjectPath(options.projectRoot))) {
    projectFile = loadArkProject(options.projectRoot);
    existingIds = projectFile.agents ?? [];
  }

  const addedIds = options.agentIds.filter((id) => !existingIds.includes(id));
  const agentIds = options.mergeWithExisting
    ? mergeAgentIds(existingIds, options.agentIds)
    : options.agentIds;

  if (projectFile) {
    projectFile = { ...projectFile, agents: agentIds };
    writeArkProject(options.projectRoot, projectFile);
  }

  const installed: InstalledAgent[] = [];
  for (const agentId of agentIds) {
    const agentEntry = registry.agents.find((a) => a.id === agentId);
    if (!agentEntry) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    installed.push(
      await installAgent({
        agent: agentEntry,
        catalogRoot: catalog.rootFor("agent", agentId),
        projectRoot: options.projectRoot,
      }),
    );
  }

  writeAgentsIndex(
    options.projectRoot,
    installed,
    options.postInstallNotes ?? [],
  );

  const allPostInstall = installed.flatMap((a) => a.post ?? []);
  const postScope = options.runPostInstallFor
    ? new Set(options.runPostInstallFor)
    : null;
  const postInstall = postScope
    ? installed
        .filter((a) => postScope.has(a.id))
        .flatMap((a) => a.post ?? [])
    : allPostInstall;

  if (options.runPostInstall && postInstall.length) {
    runPostInstallCommands(options.projectRoot, postInstall);
  }

  return {
    postInstall: allPostInstall,
    ranPostInstall: postInstall,
    addedIds,
    agentIds,
    installed,
  };
}
