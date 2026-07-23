import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCheckJson,
  formatCheckSarif,
  resolveCheckFormat,
  summarizeIssues,
} from "./report.js";
import type { CheckResult } from "./engine.js";

const sample: CheckResult = {
  architectureId: "feature-first",
  issues: [
    {
      severity: "error",
      code: "denied-import",
      message: "bad import",
      path: "src/foo.ts",
    },
    {
      severity: "warn",
      code: "module-naming",
      message: "name",
    },
  ],
};

describe("resolveCheckFormat", () => {
  it("honors --json over --format", () => {
    assert.equal(resolveCheckFormat({ json: true, format: "sarif" }), "json");
  });

  it("parses format", () => {
    assert.equal(resolveCheckFormat({ format: "sarif" }), "sarif");
    assert.equal(resolveCheckFormat({}), "text");
  });

  it("rejects invalid format", () => {
    assert.throws(() => resolveCheckFormat({ format: "xml" }), /Invalid --format/);
  });
});

describe("summarizeIssues / formatCheckJson", () => {
  it("summarizes and marks ok false when errors exist", () => {
    assert.deepEqual(summarizeIssues(sample.issues), {
      errors: 1,
      warnings: 1,
    });
    const parsed = JSON.parse(formatCheckJson(sample));
    assert.equal(parsed.ok, false);
    assert.equal(parsed.architectureId, "feature-first");
    assert.equal(parsed.issues.length, 2);
  });
});

describe("formatCheckSarif", () => {
  it("emits SARIF 2.1.0 with rule and location", () => {
    const doc = JSON.parse(
      formatCheckSarif(sample, { toolVersion: "0.5.0" }),
    );
    assert.equal(doc.version, "2.1.0");
    assert.equal(doc.runs[0].tool.driver.name, "arkctl");
    assert.equal(doc.runs[0].results[0].ruleId, "denied-import");
    assert.equal(
      doc.runs[0].results[0].locations[0].physicalLocation.artifactLocation
        .uri,
      "src/foo.ts",
    );
  });
});
