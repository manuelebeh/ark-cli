/** Minimal glob: `**` and `*` only, anchored to full relative path. */
export function matchSimpleGlob(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<DS>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<DS>>>/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

/**
 * Import-rule glob: a trailing `/*` (not `/**`) also matches descendants,
 * so `features/*` matches `features/billing/ui/Foo.ts`.
 */
export function matchImportGlob(path: string, pattern: string): boolean {
  if (matchSimpleGlob(path, pattern)) return true;
  if (/(?:^|\/)\*$/.test(pattern) && !pattern.endsWith("/**")) {
    return matchSimpleGlob(path, `${pattern}/**`);
  }
  return false;
}
