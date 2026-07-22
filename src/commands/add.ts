import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
} from "../catalog/load.js";
import { fetchGithubSource, parseGithubSource } from "../fetch/github.js";
import { copyDir } from "../fs/files.js";
import type { ProjectEntry, ProjectManifest, Registry } from "../types.js";

function looksLikeGithubLocator(input: string): boolean {
  if (input.startsWith("github:")) return true;
  const raw = input.trim();
  if (raw.startsWith(".") || raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw)) {
    return false;
  }
  const withoutAt = raw.split("@")[0] ?? raw;
  const repoPart = withoutAt.split("//")[0] ?? withoutAt;
  const parts = repoPart.split("/");
  return parts.length === 2 && Boolean(parts[0] && parts[1]);
}

function normalizeGithubLocator(input: string): string {
  return input.replace(/^github:/, "").trim();
}

async function resolveSourcePack(source: string): Promise<{
  kind: "local" | "github";
  packRoot: string;
  github?: string;
}> {
  const absolute = resolve(source);
  if (existsSync(absolute)) {
    return { kind: "local", packRoot: absolute };
  }
  if (existsSync(source)) {
    return { kind: "local", packRoot: resolve(source) };
  }
  if (!looksLikeGithubLocator(source)) {
    throw new Error(
      `Source not found (local path) and not a GitHub locator: ${source}`,
    );
  }
  const locator = normalizeGithubLocator(source);
  const packRoot = await fetchGithubSource(parseGithubSource(locator));
  return { kind: "github", packRoot, github: locator };
}

function upsertProjectEntry(registry: Registry, entry: ProjectEntry): Registry {
  const projects = [...(registry.projects ?? [])];
  const idx = projects.findIndex((p) => p.id === entry.id);
  if (idx >= 0) projects[idx] = entry;
  else projects.push(entry);
  return { ...registry, projects };
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

    const archId = manifest.implements.architecture;
    if (!findArchitecture(registry, archId)) {
      p.cancel(
        `Architecture "${archId}" is not in the catalog. Add it first or use a known id (e.g. feature-first).`,
      );
      process.exit(1);
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
    p.outro(`Create with: ark create <name> --project ${projectId}`);
  },
});

export const addCommand = defineCommand({
  meta: {
    name: "add",
    description: "Add packs to the user catalog",
  },
  subCommands: {
    project: addProjectCommand,
  },
});
