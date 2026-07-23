import type { CheckIssue } from "../types.js";
import type { CheckResult } from "./engine.js";

export type CheckReportFormat = "text" | "json" | "sarif";

export type CheckJsonReport = {
  ok: boolean;
  architectureId: string;
  summary: { errors: number; warnings: number };
  issues: CheckIssue[];
};

export function resolveCheckFormat(args: {
  json?: boolean | string;
  format?: string;
}): CheckReportFormat {
  if (args.json === true || args.json === "") {
    return "json";
  }
  const raw = String(args.format ?? "text").toLowerCase();
  if (raw === "json" || raw === "sarif" || raw === "text") {
    return raw;
  }
  throw new Error(`Invalid --format "${args.format}" (expected text|json|sarif)`);
}

export function summarizeIssues(issues: CheckIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

export function formatCheckJson(result: CheckResult): string {
  const summary = summarizeIssues(result.issues);
  const report: CheckJsonReport = {
    ok: summary.errors === 0,
    architectureId: result.architectureId,
    summary,
    issues: result.issues,
  };
  return `${JSON.stringify(report, null, 2)}\n`;
}

type SarifLevel = "error" | "warning" | "note" | "none";

function sarifLevel(severity: CheckIssue["severity"]): SarifLevel {
  return severity === "error" ? "error" : "warning";
}

export function formatCheckSarif(
  result: CheckResult,
  options: { toolVersion: string },
): string {
  const rulesById = new Map<string, { id: string; shortDescription: { text: string } }>();
  for (const issue of result.issues) {
    if (!rulesById.has(issue.code)) {
      rulesById.set(issue.code, {
        id: issue.code,
        shortDescription: { text: issue.code },
      });
    }
  }

  const results = result.issues.map((issue) => {
    const entry: {
      ruleId: string;
      level: SarifLevel;
      message: { text: string };
      locations?: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
        };
      }>;
    } = {
      ruleId: issue.code,
      level: sarifLevel(issue.severity),
      message: { text: issue.message },
    };
    if (issue.path) {
      entry.locations = [
        {
          physicalLocation: {
            artifactLocation: { uri: issue.path.replace(/\\/g, "/") },
          },
        },
      ];
    }
    return entry;
  });

  const doc = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ark",
            version: options.toolVersion,
            informationUri: "https://github.com/manuelebeh/ark-cli",
            rules: [...rulesById.values()],
          },
        },
        results,
      },
    ],
  };

  return `${JSON.stringify(doc, null, 2)}\n`;
}
