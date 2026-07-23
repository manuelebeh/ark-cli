import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { resolve } from "node:path";
import { userCatalogRoot } from "../catalog/load.js";
import { checkProject } from "../check/engine.js";
import {
  formatCheckJson,
  formatCheckSarif,
  resolveCheckFormat,
  summarizeIssues,
} from "../check/report.js";

const TOOL_VERSION = "0.5.0";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Validate a project against its architecture contract",
  },
  args: {
    path: {
      type: "positional",
      description: "Project path (default: .)",
      required: false,
      default: ".",
    },
    catalog: {
      type: "string",
      description: "User catalog directory (default: ~/.ark/catalog)",
    },
    json: {
      type: "boolean",
      description: "Emit JSON to stdout (alias for --format json)",
      default: false,
    },
    format: {
      type: "string",
      description: "Output format: text | json | sarif (default: text)",
      default: "text",
    },
  },
  async run({ args }) {
    let format;
    try {
      format = resolveCheckFormat({
        json: args.json,
        format: args.format,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    }

    const root = resolve(args.path);
    const machine = format === "json" || format === "sarif";

    if (!machine) {
      p.intro(`ark check → ${root}`);
    }

    const userRoot = args.catalog
      ? String(args.catalog)
      : userCatalogRoot();

    let result;
    try {
      result = await checkProject(root, { userCatalogRoot: userRoot });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (machine) {
        console.error(message);
      } else {
        p.cancel(message);
      }
      process.exit(1);
    }

    const { errors, warnings } = summarizeIssues(result.issues);

    if (format === "json") {
      process.stdout.write(formatCheckJson(result));
      if (errors > 0) process.exit(1);
      return;
    }

    if (format === "sarif") {
      process.stdout.write(
        formatCheckSarif(result, { toolVersion: TOOL_VERSION }),
      );
      if (errors > 0) process.exit(1);
      return;
    }

    if (result.issues.length === 0) {
      p.log.success(`OK: architecture "${result.architectureId}"`);
      p.outro("No issues");
      return;
    }

    for (const issue of result.issues) {
      const label = issue.path ? `${issue.path}: ${issue.message}` : issue.message;
      if (issue.severity === "error") {
        p.log.error(`[${issue.code}] ${label}`);
      } else {
        p.log.warn(`[${issue.code}] ${label}`);
      }
    }

    p.outro(
      `${errors} error(s), ${warnings} warning(s) (${result.architectureId})`,
    );
    if (errors > 0) {
      process.exit(1);
    }
  },
});
