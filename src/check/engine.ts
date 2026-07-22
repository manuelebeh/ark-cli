import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  loadMergedCatalog,
  readYamlFile,
  type LoadedCatalog,
} from "../catalog/load.js";
import { resolvePackRoot } from "../catalog/resolve-pack.js";
import { listFilesRecursive } from "../fs/files.js";
import type {
  ArchitectureManifest,
  ArkProjectFile,
  CheckIssue,
  Conventions,
  TreeSchema,
} from "../types.js";

export type CheckResult = {
  architectureId: string;
  issues: CheckIssue[];
};

export type CheckOptions = {
  catalog?: LoadedCatalog;
  userCatalogRoot?: string;
};

export async function checkProject(
  projectRoot: string,
  options: CheckOptions = {},
): Promise<CheckResult> {
  const projectFile = join(projectRoot, "ark.project.yaml");
  if (!existsSync(projectFile)) {
    return {
      architectureId: "unknown",
      issues: [
        {
          severity: "error",
          code: "missing-project-file",
          message: "No ark.project.yaml found in project root",
          path: "ark.project.yaml",
        },
      ],
    };
  }

  const catalog =
    options.catalog ??
    loadMergedCatalog({ userRoot: options.userCatalogRoot });
  const { registry } = catalog;

  const project = readYamlFile<ArkProjectFile>(projectFile);
  const archId = project.implements.architecture;
  const archEntry = registry.architectures.find((a) => a.id === archId);
  if (!archEntry) {
    return {
      architectureId: archId,
      issues: [
        {
          severity: "error",
          code: "unknown-architecture",
          message: `Architecture "${archId}" is not in the catalog`,
          path: "ark.project.yaml",
        },
      ],
    };
  }

  const archCatalogRoot = catalog.rootFor("architecture", archEntry.id);
  const archDir = await resolvePackRoot(archEntry, archCatalogRoot);
  const archManifest = readYamlFile<ArchitectureManifest>(
    join(archDir, "manifest.yaml"),
  );
  const tree = readYamlFile<TreeSchema>(
    join(archDir, archManifest.files.tree),
  );
  const conventions = readYamlFile<Conventions>(
    join(archDir, archManifest.files.conventions),
  );

  const severity = archManifest.default_severity;
  const issues: CheckIssue[] = [];
  const files = listFilesRecursive(projectRoot);

  for (const root of tree.roots.required) {
    const abs = join(projectRoot, root);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      issues.push({
        severity,
        code: "missing-root",
        message: `Required root directory missing: ${root}`,
        path: root,
      });
    }
  }

  for (const forbidden of tree.forbid ?? []) {
    const matches = files.filter((f) => matchSimpleGlob(f, forbidden));
    for (const match of matches) {
      issues.push({
        severity,
        code: "forbidden-path",
        message: `Forbidden path under ${archId}: ${forbidden}`,
        path: match,
      });
    }
  }

  const featuresDir = join(projectRoot, "features");
  if (existsSync(featuresDir)) {
    const featureNames = readdirSync(featuresDir).filter((name) =>
      statSync(join(featuresDir, name)).isDirectory(),
    );
    const naming = new RegExp(conventions.naming.features.pattern);

    for (const name of featureNames) {
      if (!naming.test(name)) {
        issues.push({
          severity,
          code: "feature-naming",
          message: `Feature name "${name}" does not match ${conventions.naming.features.pattern}`,
          path: `features/${name}`,
        });
      }

      for (const child of tree.feature.required_children) {
        const required = join(featuresDir, name, child);
        if (!existsSync(required)) {
          issues.push({
            severity,
            code: "missing-feature-file",
            message: `Feature "${name}" is missing required ${child}`,
            path: `features/${name}/${child}`,
          });
        }
      }
    }
  }

  return { architectureId: archId, issues };
}

/** Minimal glob: `**` and `*` only, anchored to full relative path. */
function matchSimpleGlob(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<DS>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<DS>>>/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}
