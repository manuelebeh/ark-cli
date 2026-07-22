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
import { applyExceptions, loadExceptions } from "./exceptions.js";
import { matchSimpleGlob } from "./glob.js";
import { checkImports, parseModulesPath } from "./imports.js";
import { resolveSeverity } from "./severity.js";

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

  const issues: CheckIssue[] = [];
  const files = listFilesRecursive(projectRoot);

  for (const root of tree.roots.required) {
    const abs = join(projectRoot, root);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      issues.push({
        severity: resolveSeverity(archManifest, "missing-root"),
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
        severity: resolveSeverity(archManifest, "forbidden-path"),
        code: "forbidden-path",
        message: `Forbidden path under ${archId}: ${forbidden}`,
        path: match,
      });
    }
  }

  if (tree.modules) {
    const { parentDir } = parseModulesPath(tree.modules.path);
    const modulesDir = join(projectRoot, parentDir);
    if (existsSync(modulesDir)) {
      const moduleNames = readdirSync(modulesDir).filter((name) =>
        statSync(join(modulesDir, name)).isDirectory(),
      );
      const namingPattern = conventions.naming?.modules?.pattern;
      const naming = namingPattern ? new RegExp(namingPattern) : null;

      for (const name of moduleNames) {
        if (naming && namingPattern && !naming.test(name)) {
          issues.push({
            severity: resolveSeverity(archManifest, "module-naming"),
            code: "module-naming",
            message: `Module name "${name}" does not match ${namingPattern}`,
            path: `${parentDir}/${name}`,
          });
        }

        for (const child of tree.modules.required_children) {
          const required = join(modulesDir, name, child);
          if (!existsSync(required)) {
            issues.push({
              severity: resolveSeverity(archManifest, "missing-module-file"),
              code: "missing-module-file",
              message: `Module "${name}" is missing required ${child}`,
              path: `${parentDir}/${name}/${child}`,
            });
          }
        }
      }
    }
  }

  issues.push(
    ...checkImports(
      projectRoot,
      files,
      conventions,
      archManifest,
      tree.modules?.path,
    ),
  );

  const exceptions = loadExceptions(projectRoot, tree.allow_exceptions_file);
  return {
    architectureId: archId,
    issues: applyExceptions(issues, exceptions),
  };
}
