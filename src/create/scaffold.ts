import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installAgent, writeAgentsIndex } from "../agents/install.js";
import {
  loadMergedCatalog,
  readYamlFile,
  type LoadedCatalog,
} from "../catalog/load.js";
import { resolvePackRoot } from "../catalog/resolve-pack.js";
import { copyTemplateDir } from "../fs/files.js";
import type { ArchitectureManifest, ProjectManifest } from "../types.js";

export type CreateOptions = {
  name: string;
  targetDir: string;
  projectId: string;
  agentIds: string[];
  /** Pre-loaded catalog; if omitted, loads merged built-in + user. */
  catalog?: LoadedCatalog;
  /** Override user catalog root (from --catalog / ARK_CATALOG_DIR). */
  userCatalogRoot?: string;
  /** When true, run tool-skill post-install commands. */
  runPostInstall?: boolean;
  /** Extra human notes appended to .agents/POSTINSTALL.md */
  postInstallNotes?: string[];
};

export async function createProject(options: CreateOptions): Promise<{
  postInstall: string[];
}> {
  const catalog =
    options.catalog ??
    loadMergedCatalog({ userRoot: options.userCatalogRoot });
  const { registry } = catalog;

  const projectEntry = registry.projects.find((p) => p.id === options.projectId);
  if (!projectEntry) {
    throw new Error(`Unknown project type: ${options.projectId}`);
  }

  const projectCatalogRoot = catalog.rootFor("project", projectEntry.id);
  const projectPackRoot = await resolvePackRoot(projectEntry, projectCatalogRoot);
  const projectManifest = readYamlFile<ProjectManifest>(
    join(projectPackRoot, "manifest.yaml"),
  );
  const templateRoot = join(projectPackRoot, projectManifest.source.root);

  const archId = projectManifest.implements.architecture;
  const archEntry = registry.architectures.find((a) => a.id === archId);
  if (!archEntry) {
    throw new Error(`Architecture not found in registry: ${archId}`);
  }

  const archCatalogRoot = catalog.rootFor("architecture", archEntry.id);
  const archDir = await resolvePackRoot(archEntry, archCatalogRoot);
  const archManifest = readYamlFile<ArchitectureManifest>(
    join(archDir, "manifest.yaml"),
  );

  const vars = {
    project_name: options.name,
  };

  mkdirSync(options.targetDir, { recursive: true });
  copyTemplateDir(templateRoot, options.targetDir, vars);

  writeFileSync(
    join(options.targetDir, "ark.project.yaml"),
    [
      "schema_version: 1",
      "implements:",
      `  architecture: ${archId}`,
      `  architecture_version: ${archManifest.version}`,
      "project:",
      `  id: ${projectManifest.id}`,
      `  name: ${options.name}`,
      "agents:",
      ...options.agentIds.map((id) => `  - ${id}`),
      "",
    ].join("\n"),
    "utf8",
  );

  const layout = readFileSync(join(archDir, archManifest.files.layout), "utf8");
  writeFileSync(join(options.targetDir, "ARCHITECTURE.md"), layout, "utf8");

  const installed = [];
  for (const agentId of options.agentIds) {
    const agentEntry = registry.agents.find((a) => a.id === agentId);
    if (!agentEntry) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    installed.push(
      await installAgent({
        agent: agentEntry,
        catalogRoot: catalog.rootFor("agent", agentId),
        projectRoot: options.targetDir,
      }),
    );
  }

  writeAgentsIndex(options.targetDir, installed, options.postInstallNotes);

  const postInstall = installed.flatMap((a) => a.post ?? []);
  if (options.runPostInstall && postInstall.length) {
    const { spawnSync } = await import("node:child_process");
    for (const cmd of postInstall) {
      const result = spawnSync(cmd, {
        cwd: options.targetDir,
        shell: true,
        encoding: "utf8",
        stdio: "inherit",
      });
      if (result.status !== 0) {
        throw new Error(`Post-install failed: ${cmd}`);
      }
    }
  }

  return { postInstall };
}
