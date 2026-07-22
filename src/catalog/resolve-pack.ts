import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fetchGithubSource, parseGithubSource } from "../fetch/github.js";
import type { ArchitectureEntry, ProjectEntry } from "../types.js";
import { resolveCatalogPath } from "./load.js";

export function looksLikeGithubLocator(input: string): boolean {
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

export function normalizeGithubLocator(input: string): string {
  return input.replace(/^github:/, "").trim();
}

export async function resolveSourcePack(source: string): Promise<{
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

export async function resolvePackRoot(
  entry: ProjectEntry | ArchitectureEntry,
  catalogRoot: string,
): Promise<string> {
  if (entry.source === "github") {
    if (!entry.github) {
      throw new Error(`Entry ${entry.id} is remote but missing github locator`);
    }
    return fetchGithubSource(parseGithubSource(entry.github));
  }
  if (!entry.path) {
    throw new Error(`Local entry ${entry.id} missing path`);
  }
  return resolveCatalogPath(catalogRoot, entry.path);
}
