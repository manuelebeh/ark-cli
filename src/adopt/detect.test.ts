import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { loadMergedCatalog } from "../catalog/load.js";
import {
  defaultProjectName,
  detectStacks,
  scoreArchitectures,
} from "./detect.js";

describe("detectStacks", () => {
  const dirs: string[] = [];
  after(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects laravel from artisan + composer", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(join(dir, "composer.json"), JSON.stringify({ name: "app/app" }));
    writeFileSync(join(dir, "artisan"), "#!/usr/bin/env php\n");
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("php"));
    assert.ok(result.tags.includes("laravel"));
  });

  it("detects next from package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("next"));
    assert.ok(result.tags.includes("react"));
  });
});

describe("scoreArchitectures", () => {
  const dirs: string[] = [];
  after(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("scores feature-first higher when features/ and shared/ exist", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-score-"));
    dirs.push(dir);
    mkdirSync(join(dir, "features"));
    mkdirSync(join(dir, "shared"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "demo" }),
    );

    const catalog = loadMergedCatalog();
    const scores = await scoreArchitectures(dir, catalog, ["typescript", "lib"]);
    const featureFirst = scores.find((s) => s.architectureId === "feature-first");
    assert.ok(featureFirst);
    assert.ok(featureFirst!.score > 0);
    assert.deepEqual(featureFirst!.missingRequired, []);
  });
});

describe("defaultProjectName", () => {
  it("uses basename when name omitted", () => {
    assert.equal(defaultProjectName("/tmp/my-app"), "my-app");
    assert.equal(defaultProjectName("/tmp/my-app", "Custom"), "Custom");
  });
});
