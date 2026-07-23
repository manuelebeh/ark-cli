import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { LoadedCatalog } from "../catalog/load.js";
import type { AgentEntry } from "../types.js";
import {
  loadArkProject,
  writeArkProject,
} from "./project-agents.js";
import {
  installAgent,
  writeAgentsIndex,
  type InstalledAgent,
} from "./install.js";

export type UninstallAgentsResult = {
  removedIds: string[];
  remainingIds: string[];
  installed: InstalledAgent[];
};

function agentSkillTarget(agent: AgentEntry): string {
  return agent.install?.target ?? `.agents/skills/${agent.id}`;
}

export async function uninstallAgentsFromProject(options: {
  projectRoot: string;
  agentIds: string[];
  catalog: LoadedCatalog;
}): Promise<UninstallAgentsResult> {
  const projectFile = loadArkProject(options.projectRoot);
  const existing = projectFile.agents ?? [];
  const toRemove = [...new Set(options.agentIds)];
  const missing = toRemove.filter((id) => !existing.includes(id));
  if (missing.length) {
    throw new Error(`Agent(s) not installed: ${missing.join(", ")}`);
  }

  const remainingIds = existing.filter((id) => !toRemove.includes(id));

  for (const id of toRemove) {
    const agentDir = join(options.projectRoot, "agents", id);
    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true });
    }
    const entry = options.catalog.registry.agents.find((a) => a.id === id);
    if (entry) {
      const skillRel = agentSkillTarget(entry);
      const skillAbs = join(options.projectRoot, skillRel);
      if (existsSync(skillAbs)) {
        rmSync(skillAbs, { recursive: true, force: true });
      }
    } else {
      const fallback = join(
        options.projectRoot,
        ".agents",
        "skills",
        id,
      );
      if (existsSync(fallback)) {
        rmSync(fallback, { recursive: true, force: true });
      }
    }
  }

  writeArkProject(options.projectRoot, {
    ...projectFile,
    agents: remainingIds,
  });

  const installed: InstalledAgent[] = [];
  for (const agentId of remainingIds) {
    const agentEntry = options.catalog.registry.agents.find(
      (a) => a.id === agentId,
    );
    if (!agentEntry) {
      throw new Error(`Unknown agent still listed: ${agentId}`);
    }
    installed.push(
      await installAgent({
        agent: agentEntry,
        catalogRoot: options.catalog.rootFor("agent", agentId),
        projectRoot: options.projectRoot,
      }),
    );
  }

  writeAgentsIndex(options.projectRoot, installed, []);

  const postInstallPath = join(
    options.projectRoot,
    ".agents",
    "POSTINSTALL.md",
  );
  const hasPost = installed.some((a) => (a.post ?? []).length > 0);
  if (!hasPost && existsSync(postInstallPath)) {
    rmSync(postInstallPath, { force: true });
  }

  return {
    removedIds: toRemove,
    remainingIds,
    installed,
  };
}
