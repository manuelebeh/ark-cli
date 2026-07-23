import type { ProjectEntry } from "../types.js";

export type StackGroup = {
  /** Stable key: sorted lowercase stack tags joined by comma. */
  key: string;
  stacks: string[];
  label: string;
  projects: ProjectEntry[];
};

export function stackKey(stacks?: string[]): string {
  return [...(stacks ?? [])]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function baseProjectName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function groupLabel(projects: ProjectEntry[], stacks: string[]): string {
  const bases = [...new Set(projects.map((p) => baseProjectName(p.name)))];
  if (bases.length === 1 && bases[0]) return bases[0];
  if (stacks.length) return stacks.join(" · ");
  return "Other";
}

/** Group project types that share the same stack tag set. */
export function listStackGroups(projects: ProjectEntry[]): StackGroup[] {
  const byKey = new Map<string, ProjectEntry[]>();
  for (const project of projects) {
    const key = stackKey(project.stacks);
    const list = byKey.get(key) ?? [];
    list.push(project);
    byKey.set(key, list);
  }

  return [...byKey.entries()]
    .map(([key, groupProjects]) => {
      const stacks = groupProjects[0]?.stacks ?? [];
      return {
        key,
        stacks: [...stacks],
        label: groupLabel(groupProjects, stacks),
        projects: groupProjects,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findStackGroup(
  groups: StackGroup[],
  stacks: string[],
): StackGroup | undefined {
  const key = stackKey(stacks);
  return groups.find((g) => g.key === key);
}

export function formatStackTags(stacks: string[]): string {
  return stacks.length ? stacks.join(",") : "(none)";
}

export function resolveProjectInGroup(
  group: StackGroup,
  architectureId: string,
): ProjectEntry | undefined {
  return group.projects.find((p) => p.implements === architectureId);
}
