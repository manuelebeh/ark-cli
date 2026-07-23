import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGithubSource } from "./github.js";

describe("parseGithubSource", () => {
  it("parses owner/repo@ref", () => {
    assert.deepEqual(parseGithubSource("acme/widgets@v1"), {
      owner: "acme",
      repo: "widgets",
      path: "",
      ref: "v1",
    });
  });

  it("parses github: prefix and nested path", () => {
    assert.deepEqual(
      parseGithubSource("github:acme/widgets//skills/foo@main"),
      {
        owner: "acme",
        repo: "widgets",
        path: "skills/foo",
        ref: "main",
      },
    );
  });

  it("defaults ref to main", () => {
    assert.equal(parseGithubSource("acme/widgets").ref, "main");
  });

  it("rejects invalid locator", () => {
    assert.throws(() => parseGithubSource("not-valid"), /Invalid GitHub source/);
  });
});
