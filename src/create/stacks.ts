import type { ProjectEntry } from "../types.js";

export type StackGroup = {
  /** Stable key: sorted lowercase stack tags joined by comma. */
  key: string;
  stacks: string[];
  label: string;
  projects: ProjectEntry[];
};

/** Known language / runtime tags used to bucket stack families. */
export const LANGUAGE_TAGS = [
  "typescript",
  "javascript",
  "php",
  "python",
  "ruby",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "dart",
  "csharp",
  "scala",
  "elixir",
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  php: "PHP",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  dart: "Dart",
  csharp: "C#",
  scala: "Scala",
  elixir: "Elixir",
  other: "Other",
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

export function languageFromStacks(stacks: string[]): string {
  const lower = new Set(stacks.map((s) => s.toLowerCase()));
  for (const lang of LANGUAGE_TAGS) {
    if (lower.has(lang)) return lang;
  }
  return "other";
}

export function formatLanguageLabel(language: string): string {
  return LANGUAGE_LABELS[language.toLowerCase()] ?? language;
}

export function isLanguageTag(tag: string): boolean {
  const lower = tag.toLowerCase();
  return (
    lower === "other" ||
    (LANGUAGE_TAGS as readonly string[]).includes(lower)
  );
}

/** Distinct languages present in the given stack groups (sorted). */
export function listLanguages(groups: StackGroup[]): string[] {
  const set = new Set(groups.map((g) => languageFromStacks(g.stacks)));
  return [...set].sort((a, b) => {
    if (a === "other") return 1;
    if (b === "other") return -1;
    return formatLanguageLabel(a).localeCompare(formatLanguageLabel(b));
  });
}

export function stackGroupsForLanguage(
  groups: StackGroup[],
  language: string,
): StackGroup[] {
  const lang = language.toLowerCase();
  return groups.filter((g) => languageFromStacks(g.stacks) === lang);
}

/**
 * Resolve --stack input:
 * - exact tag set → one group
 * - single language tag (e.g. python) → groups for that language
 * - single framework tag (e.g. django) → groups containing that tag
 */
export function resolveStackFlag(
  groups: StackGroup[],
  stacks: string[],
): {
  group?: StackGroup;
  language?: string;
  candidates: StackGroup[];
} {
  const exact = findStackGroup(groups, stacks);
  if (exact) {
    return {
      group: exact,
      language: languageFromStacks(exact.stacks),
      candidates: [exact],
    };
  }

  if (stacks.length === 1) {
    const tag = stacks[0]!.toLowerCase();
    if (isLanguageTag(tag)) {
      const candidates = stackGroupsForLanguage(groups, tag);
      if (candidates.length === 1) {
        return {
          group: candidates[0],
          language: tag,
          candidates,
        };
      }
      return { language: tag, candidates };
    }

    const candidates = groups.filter((g) =>
      g.stacks.some((s) => s.toLowerCase() === tag),
    );
    if (candidates.length === 1) {
      return {
        group: candidates[0],
        language: languageFromStacks(candidates[0]!.stacks),
        candidates,
      };
    }
    if (candidates.length > 1) {
      return {
        language: languageFromStacks(candidates[0]!.stacks),
        candidates,
      };
    }
  }

  return { candidates: [] };
}

export function resolveProjectInGroup(
  group: StackGroup,
  architectureId: string,
): ProjectEntry | undefined {
  return group.projects.find((p) => p.implements === architectureId);
}
