import type {
  ArchitectureManifest,
  CheckSeverity,
} from "../types.js";

export function resolveSeverity(
  manifest: ArchitectureManifest,
  code: string,
  ruleSeverity?: CheckSeverity,
): CheckSeverity {
  if (ruleSeverity) return ruleSeverity;
  return manifest.severity?.[code] ?? manifest.default_severity;
}
