import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  readYamlFile,
  type LoadedCatalog,
} from "../catalog/load.js";
import { resolvePackRoot } from "../catalog/resolve-pack.js";
import type {
  ArchitectureManifest,
  ProjectEntry,
  TreeSchema,
} from "../types.js";

export type StackDetection = {
  tags: string[];
  signals: string[];
};

export type ArchitectureScore = {
  architectureId: string;
  score: number;
  matchedRequired: string[];
  missingRequired: string[];
  matchedOptional: string[];
  projectId?: string;
};

function readTextIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function jsonDeps(path: string): string {
  const raw = readTextIfExists(path);
  if (!raw) return "";
  try {
    const data = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      require?: Record<string, string>;
      "require-dev"?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(data.dependencies ?? {}),
      ...Object.keys(data.devDependencies ?? {}),
      ...Object.keys(data.require ?? {}),
      ...Object.keys(data["require-dev"] ?? {}),
    ].join(" ");
  } catch {
    return raw;
  }
}

/** Detect stack tags from common lockfiles / entrypoints. */
export function detectStacks(projectRoot: string): StackDetection {
  const tags = new Set<string>();
  const signals: string[] = [];

  const composer = join(projectRoot, "composer.json");
  if (existsSync(composer)) {
    tags.add("php");
    signals.push("composer.json");
    const deps = jsonDeps(composer).toLowerCase();
    if (
      existsSync(join(projectRoot, "artisan")) ||
      deps.includes("laravel/framework")
    ) {
      tags.add("laravel");
      signals.push(existsSync(join(projectRoot, "artisan")) ? "artisan" : "laravel/framework");
    }
  }

  const pyproject = join(projectRoot, "pyproject.toml");
  const requirements = join(projectRoot, "requirements.txt");
  const managePy = join(projectRoot, "manage.py");
  const pyText = [
    readTextIfExists(pyproject) ?? "",
    readTextIfExists(requirements) ?? "",
  ]
    .join("\n")
    .toLowerCase();

  if (existsSync(pyproject) || existsSync(requirements) || existsSync(managePy)) {
    tags.add("python");
    if (existsSync(pyproject)) signals.push("pyproject.toml");
    if (existsSync(requirements)) signals.push("requirements.txt");
  }

  if (
    existsSync(managePy) ||
    pyText.includes("django") ||
    readTextIfExists(join(projectRoot, ".env"))?.includes("DJANGO_SETTINGS_MODULE")
  ) {
    tags.add("python");
    tags.add("django");
    signals.push(existsSync(managePy) ? "manage.py" : "django");
  }

  if (
    pyText.includes("fastapi") ||
    existsSync(join(projectRoot, "app", "main.py"))
  ) {
    tags.add("python");
    tags.add("fastapi");
    signals.push(
      existsSync(join(projectRoot, "app", "main.py"))
        ? "app/main.py"
        : "fastapi",
    );
  }

  const pkg = join(projectRoot, "package.json");
  if (existsSync(pkg)) {
    tags.add("typescript");
    signals.push("package.json");
    const deps = jsonDeps(pkg).toLowerCase();
    const hasNuxtConfig =
      existsSync(join(projectRoot, "nuxt.config.ts")) ||
      existsSync(join(projectRoot, "nuxt.config.js")) ||
      existsSync(join(projectRoot, "nuxt.config.mjs"));

    if (
      deps.includes("@nestjs/core") ||
      deps.includes("@nestjs/common") ||
      existsSync(join(projectRoot, "nest-cli.json"))
    ) {
      tags.add("nest");
      tags.add("api");
      signals.push(
        deps.includes("@nestjs/core") || deps.includes("@nestjs/common")
          ? "@nestjs/core"
          : "nest-cli.json",
      );
    } else if (deps.includes("nuxt") || hasNuxtConfig) {
      tags.add("vue");
      tags.add("nuxt");
      tags.add("web");
      signals.push(hasNuxtConfig ? "nuxt.config" : "nuxt");
    } else if (deps.includes("expo") || deps.includes("react-native")) {
      tags.add("react-native");
      tags.add("mobile");
      if (deps.includes("expo")) {
        tags.add("expo");
        signals.push("expo");
      } else {
        signals.push("react-native");
      }
    } else if (deps.includes("next")) {
      tags.add("react");
      tags.add("next");
      signals.push("next");
    } else if (deps.includes("react")) {
      tags.add("react");
      signals.push("react");
    } else {
      tags.add("lib");
      signals.push("lib");
    }
  }

  return { tags: [...tags], signals };
}

function dirExists(root: string, rel: string): boolean {
  const abs = join(root, rel);
  return existsSync(abs) && statSync(abs).isDirectory();
}

function stacksIntersect(
  detected: string[],
  candidate: string[] | undefined,
): boolean {
  if (!candidate || candidate.length === 0) return true;
  if (detected.length === 0) return true;
  if (candidate.includes("*")) return true;
  return candidate.some((t) => detected.includes(t));
}

function pickProjectForArch(
  catalog: LoadedCatalog,
  architectureId: string,
  detectedTags: string[],
): ProjectEntry | undefined {
  const matches = catalog.registry.projects.filter(
    (p) =>
      p.implements === architectureId &&
      stacksIntersect(detectedTags, p.stacks),
  );
  if (matches.length === 0) {
    return catalog.registry.projects.find((p) => p.implements === architectureId);
  }
  // Prefer projects whose stacks overlap most with detected tags
  return matches.sort((a, b) => {
    const scoreA = (a.stacks ?? []).filter((t) => detectedTags.includes(t)).length;
    const scoreB = (b.stacks ?? []).filter((t) => detectedTags.includes(t)).length;
    return scoreB - scoreA;
  })[0];
}

export async function scoreArchitectures(
  projectRoot: string,
  catalog: LoadedCatalog,
  detectedTags: string[],
): Promise<ArchitectureScore[]> {
  const scores: ArchitectureScore[] = [];

  for (const archEntry of catalog.registry.architectures) {
    const projectsForArch = catalog.registry.projects.filter(
      (p) => p.implements === archEntry.id,
    );
    const projectStacks = projectsForArch.flatMap((p) => p.stacks ?? []);
    const uniqueProjectStacks = [...new Set(projectStacks)];

    if (
      detectedTags.length > 0 &&
      uniqueProjectStacks.length > 0 &&
      !stacksIntersect(detectedTags, uniqueProjectStacks)
    ) {
      continue;
    }

    const archRoot = catalog.rootFor("architecture", archEntry.id);
    const archDir = await resolvePackRoot(archEntry, archRoot);
    const manifest = readYamlFile<ArchitectureManifest>(
      join(archDir, "manifest.yaml"),
    );
    const tree = readYamlFile<TreeSchema>(join(archDir, manifest.files.tree));

    const matchedRequired: string[] = [];
    const missingRequired: string[] = [];
    const matchedOptional: string[] = [];
    let score = 0;

    for (const root of tree.roots.required) {
      if (dirExists(projectRoot, root)) {
        matchedRequired.push(root);
        score += 2;
      } else {
        missingRequired.push(root);
        score -= 3;
      }
    }
    for (const root of tree.roots.optional ?? []) {
      if (dirExists(projectRoot, root)) {
        matchedOptional.push(root);
        score += 1;
      }
    }

    const project = pickProjectForArch(catalog, archEntry.id, detectedTags);
    if (project) score += 1;

    scores.push({
      architectureId: archEntry.id,
      score,
      matchedRequired,
      missingRequired,
      matchedOptional,
      projectId: project?.id,
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function defaultProjectName(projectRoot: string, name?: string): string {
  return name?.trim() || basename(projectRoot);
}
