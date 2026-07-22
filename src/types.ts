export type Registry = {
  schema_version: number;
  name: string;
  version: string;
  description?: string;
  architectures: ArchitectureEntry[];
  projects: ProjectEntry[];
  agents: AgentEntry[];
  /** Named bundles of agent ids (expanded at create time). */
  presets?: PresetEntry[];
};

export type PresetEntry = {
  id: string;
  name: string;
  description?: string;
  /** Agent ids from the registry to include. */
  agents: string[];
  /** Optional post-setup notes written into POSTINSTALL.md */
  notes?: string[];
};

export type ArchitectureEntry = {
  id: string;
  name: string;
  version: string;
  /** Catalog-relative path (required when source=local). */
  path?: string;
  source: "local" | "github";
  /**
   * GitHub locator: `owner/repo//path@ref` or `github:owner/repo//path@ref`.
   * Required when source=github.
   */
  github?: string;
  ref?: string;
  repo?: string;
};

export type ProjectEntry = ArchitectureEntry & {
  implements: string;
  /** Stack tags used to filter compatible agents (e.g. react, ui, lib). */
  stacks?: string[];
};

export type AgentKind = "local" | "guidelines" | "skill" | "tool-skill";

export type AgentInstall = {
  /** Where to place a skill pack inside the generated project. */
  target?: string;
  /** Merge downloaded markdown into project AGENTS.md. */
  merge_into?: "AGENTS.md";
  /** Shell commands to suggest/run after scaffold (tool-skills). */
  post?: string[];
};

export type AgentEntry = {
  id: string;
  name: string;
  version: string;
  kind: AgentKind;
  description?: string;
  /** Local catalog-relative path (kind=local). */
  path?: string;
  source: "local" | "github";
  /**
   * GitHub locator: `owner/repo//path@ref` or `github:owner/repo//path@ref`.
   * Path may be a file (AGENTS.md) or a directory (skills/hallmark).
   */
  github?: string;
  ref?: string;
  /** If set, agent is offered only when the project stacks intersect (or stacks includes "*"). */
  stacks?: string[];
  install?: AgentInstall;
  /** Soft mutual exclusion group (e.g. "minimalism"). */
  exclusive_group?: string;
  /** Display / filter group (e.g. "matt-pocock"). */
  group?: string;
};

export type ArchitectureManifest = {
  schema_version: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  files: {
    layout: string;
    tree: string;
    conventions: string;
    agent_hints?: string;
  };
  checks: string[];
  default_severity: "error" | "warn";
};

export type TreeSchema = {
  roots: {
    required: string[];
    optional?: string[];
  };
  feature: {
    path: string;
    required_children: string[];
    optional_children?: string[];
    forbid?: string[];
  };
  shared?: {
    path: string;
    allow?: string[];
    forbid_globs?: string[];
  };
  forbid?: string[];
  allow_exceptions_file?: string;
};

export type Conventions = {
  naming: {
    features: {
      pattern: string;
    };
  };
};

export type ProjectManifest = {
  schema_version: number;
  id: string;
  name: string;
  version: string;
  implements: {
    architecture: string;
    architecture_version: string;
  };
  stack: {
    language: string;
    runtime?: string;
    /** Tags used for agent filtering. */
    tags?: string[];
    file_map?: Record<string, string>;
  };
  source: {
    root: string;
  };
};

export type AgentManifest = {
  schema_version: number;
  id: string;
  name: string;
  version: string;
  role: string;
  constraints: string[];
  tools: string[];
  system_prompt: string;
};

export type ArkProjectFile = {
  schema_version: number;
  implements: {
    architecture: string;
    architecture_version: string;
  };
  project: {
    id: string;
    name: string;
  };
  agents?: string[];
};

export type CheckIssue = {
  severity: "error" | "warn";
  code: string;
  message: string;
  path?: string;
};
