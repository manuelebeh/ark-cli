import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";

/**
 * GitHub locator forms:
 *   github:owner/repo@ref
 *   github:owner/repo//path/to/dir@ref
 *   owner/repo//path@ref
 */
export type GithubSource = {
  owner: string;
  repo: string;
  path: string;
  ref: string;
};

export function parseGithubSource(input: string): GithubSource {
  const raw = input.replace(/^github:/, "").trim();
  const at = raw.lastIndexOf("@");
  const locator = at >= 0 ? raw.slice(0, at) : raw;
  const ref = at >= 0 ? raw.slice(at + 1) : "main";

  const [repoPart, ...pathParts] = locator.split("//");
  const path = pathParts.join("//").replace(/^\/+|\/+$/g, "");
  const [owner, repo] = repoPart.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub source: ${input}`);
  }
  return { owner, repo, path, ref };
}

export function arkCacheRoot(): string {
  return process.env.ARK_CACHE_DIR ?? join(homedir(), ".ark", "cache");
}

export function repoCacheDir(source: GithubSource): string {
  return join(
    arkCacheRoot(),
    "github",
    source.owner,
    source.repo,
    source.ref.replace(/[^\w.-]+/g, "_"),
    "_repo",
  );
}

export type ClearArkCacheScope = {
  owner?: string;
  repo?: string;
  ref?: string;
};

export type ClearArkCacheResult = {
  root: string;
  removed: string[];
  dryRun: boolean;
};

/** Delete GitHub cache dirs (entire cache or a scoped owner/repo/ref). */
export function clearArkCache(
  scope: ClearArkCacheScope = {},
  options: { dryRun?: boolean } = {},
): ClearArkCacheResult {
  const dryRun = Boolean(options.dryRun);
  const root = arkCacheRoot();
  const removed: string[] = [];

  if (!existsSync(root)) {
    return { root, removed, dryRun };
  }

  let target = join(root, "github");
  if (scope.owner) {
    target = join(target, scope.owner);
    if (scope.repo) {
      target = join(target, scope.repo);
      if (scope.ref) {
        target = join(target, scope.ref.replace(/[^\w.-]+/g, "_"));
      }
    }
  }

  if (!scope.owner) {
    target = root;
  }

  if (!existsSync(target)) {
    return { root, removed, dryRun };
  }

  removed.push(target);
  if (!dryRun) {
    rmSync(target, { recursive: true, force: true });
  }
  return { root, removed, dryRun };
}

/**
 * Download+extract a GitHub repo once per owner/repo/ref, then resolve a path.
 * Multiple skills from the same repo reuse the tarball cache.
 */
export async function fetchGithubSource(source: GithubSource): Promise<string> {
  const repoRoot = await ensureRepoCached(source);
  const selected = source.path ? join(repoRoot, source.path) : repoRoot;
  if (!existsSync(selected)) {
    throw new Error(
      `Path not found in ${source.owner}/${source.repo}@${source.ref}: ${source.path || "(repo root)"}`,
    );
  }

  // Single-file sources: normalize to a directory with CONTENT.md for installers
  if (statSync(selected).isFile()) {
    const fileCache = join(repoCacheDir(source), "_files", source.path.replace(/[\/]/g, "__"));
    const marker = join(fileCache, ".ark-ok");
    if (!existsSync(marker)) {
      mkdirSync(fileCache, { recursive: true });
      const fileName = source.path.split("/").pop() || "CONTENT.md";
      writeFileSync(join(fileCache, fileName), readFileSync(selected));
      writeFileSync(join(fileCache, "CONTENT.md"), readFileSync(selected));
      writeFileSync(marker, new Date().toISOString());
    }
    return fileCache;
  }

  return selected;
}

export async function ensureRepoCached(
  source: GithubSource,
  options: { force?: boolean } = {},
): Promise<string> {
  const dest = repoCacheDir(source);
  if (options.force && existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }

  const marker = join(dest, ".ark-ok");
  const rootFile = join(dest, "ROOT");
  if (existsSync(marker) && existsSync(rootFile)) {
    const rootName = readFileSync(rootFile, "utf8").trim();
    const root = join(dest, "extract", rootName);
    if (existsSync(root)) return root;
  }

  mkdirSync(dest, { recursive: true });
  const staging = mkdtempSync(join(tmpdir(), "ark-gh-"));

  try {
    const tarballUrl = `https://codeload.github.com/${source.owner}/${source.repo}/tar.gz/${encodeURIComponent(source.ref)}`;
    const tarPath = join(staging, "repo.tar.gz");
    await downloadFile(tarballUrl, tarPath);

    const extractDir = join(dest, "extract");
    rmSync(extractDir, { recursive: true, force: true });
    mkdirSync(extractDir, { recursive: true });
    const tar = spawnSync("tar", ["-xzf", tarPath, "-C", extractDir], {
      encoding: "utf8",
    });
    if (tar.status !== 0) {
      throw new Error(
        `Failed to extract GitHub tarball ${source.owner}/${source.repo}@${source.ref}: ${tar.stderr || tar.stdout}`,
      );
    }

    const roots = listTopLevel(extractDir);
    if (roots.length !== 1) {
      throw new Error(
        `Unexpected tarball layout for ${source.owner}/${source.repo} (roots: ${roots.join(", ")})`,
      );
    }

    writeFileSync(rootFile, roots[0]!);
    writeFileSync(
      marker,
      JSON.stringify(
        {
          owner: source.owner,
          repo: source.repo,
          ref: source.ref,
          fetchedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    return join(extractDir, roots[0]!);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "arkctl",
        Accept: "application/octet-stream",
      },
      redirect: "follow",
    });
  } catch (error) {
    const cause =
      error instanceof Error && "cause" in error
        ? ` (${String((error as Error & { cause?: unknown }).cause)})`
        : "";
    throw new Error(`GitHub download failed for ${url}${cause}`);
  }
  if (!res.ok || !res.body) {
    throw new Error(`GitHub download failed (${res.status}): ${url}`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  const file = createWriteStream(dest);
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
    file,
  );
}

function listTopLevel(dir: string): string[] {
  return readdirSync(dir).filter((name) => !name.startsWith("."));
}
