import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchImportGlob, matchSimpleGlob } from "./glob.js";

describe("matchSimpleGlob", () => {
  it("matches * within a segment", () => {
    assert.equal(matchSimpleGlob("src/foo.ts", "src/*.ts"), true);
    assert.equal(matchSimpleGlob("src/a/b.ts", "src/*.ts"), false);
  });

  it("matches ** across segments", () => {
    assert.equal(matchSimpleGlob("src/a/b.ts", "src/**/*.ts"), true);
  });
});

describe("matchImportGlob", () => {
  it("treats trailing /* as descendants", () => {
    assert.equal(
      matchImportGlob("features/billing/ui/Foo.ts", "features/*"),
      true,
    );
  });
});
