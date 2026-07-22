import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
  AgentEntry,
  ArchitectureEntry,
  PresetEntry,
  ProjectEntry,
  Registry,
} from "../types.js";

const here = dirname(fileURLToPath(import.meta.url));

export type CatalogKind = "architecture" | "project" | "agent";

export type LoadedCatalog = {
  registry: Registry;
  builtinRoot: string;
  userRoot: string | null;
  /** Catalog root that owns this local entry id. */
  rootFor: (kind: CatalogKind, id: string) => string;
};

type OwnershipMaps = {
  architecture: Map<string, string>;
  project: Map<string, string>;
  agent: Map<string, string>;
};

/** Built-in catalog shipped with the CLI (dev: ../catalog, dist: ../catalog). */
export function defaultCatalogRoot(): string {
  const candidates = [
    join(here, "..", "catalog"),
    join(here, "..", "..", "catalog"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "registry.yaml"))) {
      return candidate;
    }
  }
  throw new Error("Could not locate built-in catalog/registry.yaml");
}

/** User catalog root (`ARK_CATALOG_DIR` or `~/.ark/catalog`). */
export function userCatalogRoot(override?: string): string {
  if (override) return override;
  return process.env.ARK_CATALOG_DIR ?? join(homedir(), ".ark", "catalog");
}

export function loadRegistry(catalogRoot = defaultCatalogRoot()): Registry {
  const raw = readFileSync(join(catalogRoot, "registry.yaml"), "utf8");
  return parseYaml(raw) as Registry;
}

export function resolveCatalogPath(
  catalogRoot: string,
  relativePath: string,
): string {
  return join(catalogRoot, relativePath);
}

export function readYamlFile<T>(path: string): T {
  return parseYaml(readFileSync(path, "utf8")) as T;
}

function emptyUserRegistry(): Registry {
  return {
    schema_version: 1,
    name: "ark-user",
    version: "0.1.0",
    description: "User catalog (project types and packs)",
    architectures: [],
    projects: [],
    agents: [],
    presets: [],
  };
}

/** Ensure user catalog exists with a minimal registry.yaml. */
export function ensureUserCatalog(userRoot = userCatalogRoot()): string {
  mkdirSync(userRoot, { recursive: true });
  const registryPath = join(userRoot, "registry.yaml");
  if (!existsSync(registryPath)) {
    writeUserRegistry(userRoot, emptyUserRegistry());
  }
  return userRoot;
}

export function writeUserRegistry(userRoot: string, registry: Registry): void {
  mkdirSync(userRoot, { recursive: true });
  writeFileSync(
    join(userRoot, "registry.yaml"),
    stringifyYaml(registry, { lineWidth: 0 }),
    "utf8",
  );
}

function mergeById<T extends { id: string }>(
  base: T[],
  overlay: T[],
  ownership: Map<string, string>,
  overlayRoot: string,
  baseRoot: string,
): T[] {
  const map = new Map<string, T>();
  for (const item of base) {
    map.set(item.id, item);
    ownership.set(item.id, baseRoot);
  }
  for (const item of overlay) {
    map.set(item.id, item);
    ownership.set(item.id, overlayRoot);
  }
  return [...map.values()];
}

/**
 * Load built-in catalog, optionally merge a user catalog (`--catalog` / ARK_CATALOG_DIR / ~/.ark/catalog).
 * User entries with the same id win.
 */
export function loadMergedCatalog(options?: {
  userRoot?: string;
}): LoadedCatalog {
  const builtinRoot = defaultCatalogRoot();
  const builtin = loadRegistry(builtinRoot);

  const resolvedUserRoot = options?.userRoot ?? userCatalogRoot();
  const userRegistryPath = join(resolvedUserRoot, "registry.yaml");
  const hasUser = existsSync(userRegistryPath);

  const ownership: OwnershipMaps = {
    architecture: new Map(),
    project: new Map(),
    agent: new Map(),
  };

  // Seed ownership from built-in
  for (const a of builtin.architectures) ownership.architecture.set(a.id, builtinRoot);
  for (const p of builtin.projects) ownership.project.set(p.id, builtinRoot);
  for (const a of builtin.agents) ownership.agent.set(a.id, builtinRoot);

  if (!hasUser) {
    return {
      registry: builtin,
      builtinRoot,
      userRoot: null,
      rootFor: (kind, id) => {
        const root = ownership[kind].get(id) ?? builtinRoot;
        return root;
      },
    };
  }

  const user = loadRegistry(resolvedUserRoot);

  const architectures = mergeById(
    builtin.architectures,
    user.architectures ?? [],
    ownership.architecture,
    resolvedUserRoot,
    builtinRoot,
  );
  const projects = mergeById(
    builtin.projects,
    user.projects ?? [],
    ownership.project,
    resolvedUserRoot,
    builtinRoot,
  );
  const agents = mergeById(
    builtin.agents,
    user.agents ?? [],
    ownership.agent,
    resolvedUserRoot,
    builtinRoot,
  );
  const presets = mergeById(
    builtin.presets ?? [],
    user.presets ?? [],
    new Map(),
    resolvedUserRoot,
    builtinRoot,
  );

  const registry: Registry = {
    schema_version: Math.max(builtin.schema_version, user.schema_version ?? 1),
    name: builtin.name,
    version: builtin.version,
    description: builtin.description,
    architectures,
    projects,
    agents,
    presets,
  };

  return {
    registry,
    builtinRoot,
    userRoot: resolvedUserRoot,
    rootFor: (kind, id) => ownership[kind].get(id) ?? builtinRoot,
  };
}

export function findArchitecture(
  registry: Registry,
  id: string,
): ArchitectureEntry | undefined {
  return registry.architectures.find((a) => a.id === id);
}

export function findProject(
  registry: Registry,
  id: string,
): ProjectEntry | undefined {
  return registry.projects.find((p) => p.id === id);
}

export function findAgent(
  registry: Registry,
  id: string,
): AgentEntry | undefined {
  return registry.agents.find((a) => a.id === id);
}

export function findPreset(
  registry: Registry,
  id: string,
): PresetEntry | undefined {
  return registry.presets?.find((p) => p.id === id);
}
