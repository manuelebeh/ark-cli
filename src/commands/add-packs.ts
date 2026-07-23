import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import {
  ensureUserCatalog,
  findArchitecture,
  loadMergedCatalog,
  loadRegistry,
  readYamlFile,
  userCatalogRoot,
  writeUserRegistry,
  writeYamlFile,
} from "../catalog/load.js";
import { resolveSourcePack } from "../catalog/resolve-pack.js";
import { copyDir } from "../fs/files.js";
import type {
  ArchitectureEntry,
  ArchitectureManifest,
  ProjectEntry,
  ProjectManifest,
  Registry,
} from "../types.js";

function upsertProjectEntry(registry: Registry, entry: ProjectEntry): Registry {
  const projects = [...(registry.projects ?? [])];
  const idx = projects.findIndex((p) => p.id === entry.id);
  if (idx >= 0) projects[idx] = entry;
  else projects.push(entry);
  return { ...registry, projects };
}

function upsertArchitectureEntry(
  registry: Registry,
  entry: ArchitectureEntry,
): Registry {
  const architectures = [...(registry.architectures ?? [])];
  const idx = architectures.findIndex((a) => a.id === entry.id);
  if (idx >= 0) architectures[idx] = entry;
  else architectures.push(entry);
  return { ...registry, architectures };
}

function syncLocalProjectManifest(
  destRoot: string,
  patch: {
    id: string;
    name: string;
    architecture: string;
  },
): void {
  const manifestPath = join(destRoot, "manifest.yaml");
  const manifest = readYamlFile<ProjectManifest>(manifestPath);
  manifest.id = patch.id;
  manifest.name = patch.name;
  manifest.implements = {
    ...manifest.implements,
    architecture: patch.architecture,
  };
  writeYamlFile(manifestPath, manifest);
}

function syncLocalArchitectureManifest(
  destRoot: string,
  patch: { id: string; name: string },
): void {
  const manifestPath = join(destRoot, "manifest.yaml");
  const manifest = readYamlFile<ArchitectureManifest>(manifestPath);
  manifest.id = patch.id;
  manifest.name = patch.name;
  writeYamlFile(manifestPath, manifest);
}

export const addProjectCommand = defineCommand({
  meta: {
    name: "project",
    description: "Register a project template in the user catalog",
  },
  args: {
    source: {
      type: "positional",
      description: "Local pack path or GitHub locator (owner/repo//path@ref)",
      required: true,
    },
    id: {
      type: "string",
      description: "Project id (default: from manifest)",
    },
    name: {
      type: "string",
      description: "Display name (default: from manifest)",
    },
    architecture: {
      type: "string",
      description:
        "Architecture id this project implements (default: from manifest; use when the arch was registered under a custom --id)",
      alias: "arch",
    },
    stacks: {
      type: "string",
      description: "Comma-separated stack tags (default: manifest stack.tags)",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    force: {
      type: "boolean",
      description: "Replace an existing user-catalog project with the same id",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("ark add project");

    const userRoot = ensureUserCatalog(
      args.catalog ? String(args.catalog) : userCatalogRoot(),
    );
    const catalog = loadMergedCatalog({ userRoot });
    const { registry } = catalog;

    let resolved;
    try {
      resolved = await resolveSourcePack(String(args.source));
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const manifestPath = join(resolved.packRoot, "manifest.yaml");
    if (!existsSync(manifestPath)) {
      p.cancel(`No manifest.yaml in pack: ${resolved.packRoot}`);
      process.exit(1);
    }

    const manifest = readYamlFile<ProjectManifest>(manifestPath);
    const projectId = (args.id as string | undefined) ?? manifest.id;
    const projectName = (args.name as string | undefined) ?? manifest.name;
    const stacks = args.stacks
      ? String(args.stacks)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : (manifest.stack.tags ?? []);

    const manifestArchId = manifest.implements.architecture;
    const archId =
      (args.architecture as string | undefined) ?? manifestArchId;
    if (!findArchitecture(registry, archId)) {
      p.cancel(
        `Architecture "${archId}" is not in the catalog. Add it first or use a known id (e.g. feature-first).`,
      );
      process.exit(1);
    }
    if (archId !== manifestArchId) {
      p.log.info(
        `implements.architecture: "${archId}" (manifest had "${manifestArchId}")`,
      );
    }

    const templateRel = manifest.source.root;
    const templateAbs = join(resolved.packRoot, templateRel);
    if (!existsSync(templateAbs)) {
      p.cancel(`Template root missing: ${templateAbs}`);
      process.exit(1);
    }

    const userRegistry = loadRegistry(userRoot);
    const existingUser = userRegistry.projects?.find((p) => p.id === projectId);
    if (existingUser && !args.force) {
      p.cancel(
        `Project "${projectId}" already exists in the user catalog. Use --force to replace.`,
      );
      process.exit(1);
    }

    let entry: ProjectEntry;

    if (resolved.kind === "local") {
      const dest = join(userRoot, "projects", projectId);
      if (existsSync(dest)) {
        if (!args.force) {
          p.cancel(
            `Pack directory already exists: ${dest}. Use --force to replace.`,
          );
          process.exit(1);
        }
        rmSync(dest, { recursive: true, force: true });
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyDir(resolved.packRoot, dest);
      syncLocalProjectManifest(dest, {
        id: projectId,
        name: projectName,
        architecture: archId,
      });

      entry = {
        id: projectId,
        name: projectName,
        version: manifest.version,
        implements: archId,
        path: `projects/${projectId}`,
        source: "local",
        stacks,
      };
    } else {
      if (
        archId !== manifestArchId ||
        projectId !== manifest.id ||
        projectName !== manifest.name
      ) {
        p.log.warn(
          "GitHub packs keep their remote manifest; registry entry uses your --id / --architecture overrides.",
        );
      }
      entry = {
        id: projectId,
        name: projectName,
        version: manifest.version,
        implements: archId,
        source: "github",
        github: resolved.github,
        stacks,
      };
    }

    writeUserRegistry(userRoot, upsertProjectEntry(userRegistry, entry));

    p.log.success(
      resolved.kind === "local"
        ? `Registered local project "${projectId}" → ${userRoot}`
        : `Registered GitHub project "${projectId}" (${resolved.github})`,
    );
    p.outro(
      `Create with: ark create <name> --architecture ${archId} --project ${projectId}`,
    );
  },
});

export const addArchitectureCommand = defineCommand({
  meta: {
    name: "architecture",
    description: "Register an architecture pack in the user catalog",
  },
  args: {
    source: {
      type: "positional",
      description: "Local pack path or GitHub locator (owner/repo//path@ref)",
      required: true,
    },
    id: {
      type: "string",
      description: "Architecture id (default: from manifest)",
    },
    name: {
      type: "string",
      description: "Display name (default: from manifest)",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    force: {
      type: "boolean",
      description:
        "Replace an existing user-catalog architecture with the same id",
      default: false,
    },
  },
  async run({ args }) {
    p.intro("ark add architecture");

    const userRoot = ensureUserCatalog(
      args.catalog ? String(args.catalog) : userCatalogRoot(),
    );

    let resolved;
    try {
      resolved = await resolveSourcePack(String(args.source));
    } catch (error) {
      p.cancel(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }

    const manifestPath = join(resolved.packRoot, "manifest.yaml");
    if (!existsSync(manifestPath)) {
      p.cancel(`No manifest.yaml in pack: ${resolved.packRoot}`);
      process.exit(1);
    }

    const manifest = readYamlFile<ArchitectureManifest>(manifestPath);
    const archId = (args.id as string | undefined) ?? manifest.id;
    const archName = (args.name as string | undefined) ?? manifest.name;

    const requiredFiles = [
      manifest.files.layout,
      manifest.files.tree,
      manifest.files.conventions,
    ];
    if (manifest.files.agent_hints) {
      requiredFiles.push(manifest.files.agent_hints);
    }
    for (const rel of requiredFiles) {
      const abs = join(resolved.packRoot, rel);
      if (!existsSync(abs)) {
        p.cancel(`Architecture pack missing declared file: ${rel}`);
        process.exit(1);
      }
    }

    const userRegistry = loadRegistry(userRoot);
    const existingUser = userRegistry.architectures?.find((a) => a.id === archId);
    if (existingUser && !args.force) {
      p.cancel(
        `Architecture "${archId}" already exists in the user catalog. Use --force to replace.`,
      );
      process.exit(1);
    }

    let entry: ArchitectureEntry;

    if (resolved.kind === "local") {
      const dest = join(userRoot, "architectures", archId);
      if (existsSync(dest)) {
        if (!args.force) {
          p.cancel(
            `Pack directory already exists: ${dest}. Use --force to replace.`,
          );
          process.exit(1);
        }
        rmSync(dest, { recursive: true, force: true });
      }
      mkdirSync(dirname(dest), { recursive: true });
      copyDir(resolved.packRoot, dest);
      syncLocalArchitectureManifest(dest, { id: archId, name: archName });

      entry = {
        id: archId,
        name: archName,
        version: manifest.version,
        path: `architectures/${archId}`,
        source: "local",
      };
    } else {
      if (archId !== manifest.id || archName !== manifest.name) {
        p.log.warn(
          "GitHub packs keep their remote manifest; registry entry uses your --id / --name overrides.",
        );
      }
      entry = {
        id: archId,
        name: archName,
        version: manifest.version,
        source: "github",
        github: resolved.github,
      };
    }

    writeUserRegistry(userRoot, upsertArchitectureEntry(userRegistry, entry));

    p.log.success(
      resolved.kind === "local"
        ? `Registered local architecture "${archId}" → ${userRoot}`
        : `Registered GitHub architecture "${archId}" (${resolved.github})`,
    );
    if (archId !== manifest.id) {
      p.log.info(
        `Pair projects with: ark add project <pack> --architecture ${archId}`,
      );
    }
    p.outro(`Listed with: ark list`);
  },
});
