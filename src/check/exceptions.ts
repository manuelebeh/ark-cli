import { existsSync } from "node:fs";
import { join } from "node:path";
import { readYamlFile } from "../catalog/load.js";
import type {
  ArchitectureException,
  ArchitectureExceptions,
  CheckIssue,
} from "../types.js";
import { matchSimpleGlob } from "./glob.js";

export function loadExceptions(
  projectRoot: string,
  filename: string | undefined,
): ArchitectureException[] {
  if (!filename) return [];
  const abs = join(projectRoot, filename);
  if (!existsSync(abs)) return [];
  const doc = readYamlFile<ArchitectureExceptions>(abs);
  return doc.exceptions ?? [];
}

/** Silence matching issues, or rewrite severity when exception.severity is set. */
export function applyExceptions(
  issues: CheckIssue[],
  exceptions: ArchitectureException[],
): CheckIssue[] {
  if (exceptions.length === 0) return issues;

  const out: CheckIssue[] = [];
  for (const issue of issues) {
    const match = exceptions.find(
      (ex) =>
        ex.code === issue.code &&
        issue.path !== undefined &&
        matchSimpleGlob(issue.path, ex.path),
    );
    if (!match) {
      out.push(issue);
      continue;
    }
    if (match.severity) {
      out.push({ ...issue, severity: match.severity });
    }
    // no severity → silence
  }
  return out;
}
