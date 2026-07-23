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

  it("detects nest from package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { "@nestjs/core": "11.0.0" } }),
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("nest"));
    assert.ok(result.tags.includes("api"));
    assert.ok(result.tags.includes("typescript"));
  });

  it("detects nuxt from package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { nuxt: "4.0.0" } }),
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("nuxt"));
    assert.ok(result.tags.includes("vue"));
    assert.ok(result.tags.includes("web"));
  });

  it("detects expo from package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        dependencies: { expo: "55.0.0", "react-native": "0.79.0" },
      }),
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("expo"));
    assert.ok(result.tags.includes("react-native"));
    assert.ok(result.tags.includes("mobile"));
  });

  it("detects symfony from composer + bin/console", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    mkdirSync(join(dir, "bin"), { recursive: true });
    writeFileSync(
      join(dir, "composer.json"),
      JSON.stringify({
        require: { "symfony/framework-bundle": "^7.0" },
      }),
    );
    writeFileSync(join(dir, "bin", "console"), "#!/usr/bin/env php\n");
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("php"));
    assert.ok(result.tags.includes("symfony"));
    assert.ok(!result.tags.includes("laravel"));
  });

  it("detects go from go.mod", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(join(dir, "go.mod"), "module example.com/app\n\ngo 1.22\n");
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("go"));
  });

  it("detects flutter from pubspec.yaml", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "pubspec.yaml"),
      "name: demo\ndependencies:\n  flutter:\n    sdk: flutter\n",
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("dart"));
    assert.ok(result.tags.includes("flutter"));
  });

  it("detects rust from Cargo.toml", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-detect-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "Cargo.toml"),
      '[package]\nname = "demo"\nversion = "0.1.0"\nedition = "2021"\n',
    );
    const result = detectStacks(dir);
    assert.ok(result.tags.includes("rust"));
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
