# Ark

CLI to create projects from a catalog (architectures, project types, agents) with structure contracts. Agents can be local or downloaded from GitHub on select.

```bash
ark create my-app
ark check
ark list
ark list --stack react,ui
ark add architecture ./my-arch
ark add project ./my-template
ark add agent --agents karpathy
```

## Concepts

| Concept | Role |
|---|---|
| Architecture | Contract (`feature-first`, `hexagonal`, `clean`, …): layout, naming, forbidden paths, import rules |
| Project type | Template that implements an architecture (+ stack tags) |
| Agent | Portable pack: local manifest, remote guidelines, Agent Skills, or tool-skills |

At `ark create`, you pick an **architecture** first, then a project type that implements it. Custom arches go in the user catalog (`ark add architecture`); `create` and `check` read them from the registry with no special-case code.

## Agent kinds

| Kind | Install |
|---|---|
| `local` | From built-in catalog → `agents/<id>/SYSTEM.md` |
| `guidelines` | GitHub file (e.g. `AGENTS.md`) → merge into project docs |
| `skill` | GitHub skill folder → `.agents/skills/<id>/` |
| `tool-skill` | Same as skill + optional post-install (e.g. `npx react-doctor`) |

Remote locator form: `owner/repo//path@ref`

## Quick start

```bash
npm install
npm run build
node dist/cli.js list
node dist/cli.js list --stack lib
node dist/cli.js list --stack react,next
node dist/cli.js create demo --architecture feature-first --project ts-lib --agents karpathy,feature-owner
node dist/cli.js create hex --architecture hexagonal --project ts-lib-hexagonal
node dist/cli.js create clean-demo --architecture clean --project ts-lib-clean
node dist/cli.js create web --project react-next
node dist/cli.js create api --project laravel-app
node dist/cli.js check ./demo
```

`--project` alone derives the architecture from the project type. `--architecture` / `--arch` filters project types (or must match `--project` when both are set).

Remote agents are cached under `~/.ark/cache` (override with `ARK_CACHE_DIR`).

```bash
node dist/cli.js list --group matt-pocock
node dist/cli.js create demo --project ts-lib --preset matt-pocock-core
node dist/cli.js add agent --dir ./demo --agents no-ai-slop
```

## Post-install

Some agents (`tool-skill`) and presets declare follow-up commands or notes (e.g. `npx react-doctor`, gstack `./setup`, Matt Pocock `/setup-matt-pocock-skills`).

By default Ark writes them to `.agents/POSTINSTALL.md` and does **not** run shell commands. Pass `--run-postinstall` to execute those commands during `create` or `add agent`:

```bash
node dist/cli.js create web --project react-next --agents react-doctor --run-postinstall
node dist/cli.js add agent --dir ./web --agents react-doctor --run-postinstall
```

Preset notes (Matt Pocock, gstack) land in the same `POSTINSTALL.md` Notes section.

## User catalog

Custom architectures and project types live under `~/.ark/catalog` (override with `ARK_CATALOG_DIR` or `--catalog`). They merge with the built-in catalog; same id → user wins.

```text
~/.ark/catalog/
  registry.yaml
  architectures/
    my-arch/
      manifest.yaml
      …
  projects/
    mon-stack/
      manifest.yaml
      template/
```

Register packs:

```bash
# Architecture (local copy or GitHub locator; fetched on create/check)
ark add architecture ./path/to/arch-pack
ark add architecture me/ark-packs//architectures/hexagonal@main

# Project template (local copy or GitHub locator; fetched on create)
ark add project ./path/to/pack
ark add project me/ark-templates//projects/mon-stack@main

ark add project ./pack --id mon-stack --stacks react,typescript
ark list
ark create app --architecture my-arch --project mon-stack
ark check ./app

# Add agents later (into an existing scaffold)
ark add agent --dir ./app --preset matt-pocock-core
ark add agent --dir ./app --agents karpathy,feature-owner
```

A project pack needs `manifest.yaml` (with `implements.architecture` already in the catalog) and a template root (`source.root`, usually `./template`). An architecture pack needs `manifest.yaml` plus the declared layout/tree/conventions files. Layer-only arches use roots + import deny rules; repeating units use optional `modules` in `tree.schema.yaml`.

## Presets

| Preset | Contenu |
|---|---|
| `matt-pocock-core` | Setup + grill + TDD + review + specs + implement (+ handoff) |
| `gstack-lite` | Plan/review/investigate/safety/ship Markdown skills (no Bun) |
| `gstack-full` | Official gstack setup (`git clone` + `./setup`, needs Bun) |

```bash
node dist/cli.js create app --project ts-lib --preset gstack-lite
node dist/cli.js create app --project ts-lib --preset gstack-full
node dist/cli.js list --group gstack
```

Après create avec ce preset : lancer `/setup-matt-pocock-skills` une fois dans ton agent (voir aussi `.agents/POSTINSTALL.md`).

## Architectures

| Id | Style |
|---|---|
| `feature-first` | Domain in `features/<name>/`, public API + `shared/` |
| `hexagonal` | `domain/`, `application/` (ports), `adapters/inbound|outbound/` |
| `clean` | `domain/`, `application/`, `infrastructure/` |

## Project types

| Id | Architecture | Stacks | Unlocks (interactive) |
|---|---|---|---|
| `ts-lib` | feature-first | `lib`, `typescript` | general agents only |
| `ts-lib-hexagonal` | hexagonal | `lib`, `typescript` | general agents only |
| `ts-lib-clean` | clean | `lib`, `typescript` | general agents only |
| `react-next` | feature-first | `react`, `next`, `web`, `ui`, `typescript` | Hallmark, Vercel React/Next skills, React Doctor |
| `laravel-app` | feature-first | `laravel`, `php` | Laravel pack |

TanStack skills ship via npm (`@tanstack/intent`), not as Ark catalog agents yet.

## Built-in local guidelines

- `no-ai-slop`, `no-ai-slop-skill`, `llm-guidelines`, `codequality`, `clean-code` (all stacks)
- Laravel pack: `laravel-best-practices`, `laravel-database` (stacks: `laravel`, `php`)

## Built-in remote agents

- `karpathy`: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
- `ponytail`: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (`AGENTS.md`)
- `hallmark`: [Nutlope/hallmark](https://github.com/Nutlope/hallmark)
- `vercel-react-best-practices`, `vercel-composition-patterns`, `vercel-web-design-guidelines`, `vercel-react-native`: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)
- `react-doctor`: [millionco/react-doctor](https://github.com/millionco/react-doctor) (tool-skill)

`karpathy` and `ponytail` share exclusive group `minimalism` (warning if both selected).

## Status

v0.4: GitHub download + cache, stack-filtered agent selection, remote skill/guidelines install, user catalog + `ark add` (architecture / project / agent), multi-architecture create (`feature-first`, `hexagonal`, `clean`), optional `--run-postinstall`.
