import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import type { ArchitectureManifest, Conventions } from "../types.js";
import { checkImports } from "./imports.js";

const manifest: ArchitectureManifest = {
  schema_version: 1,
  id: "feature-first",
  name: "Feature-first",
  version: "0.1.0",
  files: {
    layout: "LAYOUT.md",
    tree: "tree.schema.yaml",
    conventions: "conventions.yaml",
  },
  checks: ["tree"],
  default_severity: "error",
};

const conventions: Conventions = {
  imports: {
    deny: [{ from: "features/*", to: "features/*/domain/**" }],
  },
  placement: {
    cross_module_imports: false,
    public_api: "index.ts",
  },
};

describe("checkImports", () => {
  const dirs: string[] = [];
  after(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags denied cross-feature domain import", () => {
    const dir = mkdtempSync(join(tmpdir(), "ark-imports-"));
    dirs.push(dir);
    mkdirSync(join(dir, "features", "billing", "ui"), { recursive: true });
    mkdirSync(join(dir, "features", "auth", "domain"), { recursive: true });
    writeFileSync(
      join(dir, "features", "billing", "ui", "Pay.ts"),
      `import { User } from "../../auth/domain/user";\n`,
    );
    writeFileSync(
      join(dir, "features", "auth", "domain", "user.ts"),
      `export const User = {};\n`,
    );

    const issues = checkImports(
      dir,
      [
        "features/billing/ui/Pay.ts",
        "features/auth/domain/user.ts",
      ],
      conventions,
      manifest,
      "features/:name",
    );

    assert.ok(
      issues.some(
        (i) => i.code === "denied-import" || i.code === "cross-module-import",
      ),
      `expected import issue, got ${JSON.stringify(issues)}`,
    );
  });
});
