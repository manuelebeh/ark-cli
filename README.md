# Ark

CLI to create projects from a catalog (architectures, project types, agents) with structure contracts. Agents can be local or downloaded from GitHub on select.

```bash
ark create my-app
ark check
ark list
ark list --stack react,ui
ark add architecture ./my-arch
ark add project ./my-template
```

## Concepts

| Concept | Role |
|---|---|
| Architecture | Contract (`feature-first`, …): layout, naming, forbidden paths |
| Project type | Template that implements an architecture (+ stack tags) |
| Agent | Portable pack: local manifest, remote guidelines, Agent Skills, or tool-skills |

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
node dist/cli.js create demo --project ts-lib --agents karpathy,feature-owner
node dist/cli.js create web --project react-next
node dist/cli.js create api --project laravel-app
node dist/cli.js check ./demo
```

Remote agents are cached under `~/.ark/cache` (override with `ARK_CACHE_DIR`).

```bash
node dist/cli.js list --group matt-pocock
node dist/cli.js create demo --project ts-lib --preset matt-pocock-core
```

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
ark create app --project mon-stack
ark check ./app
```

A project pack needs `manifest.yaml` (with `implements.architecture` already in the catalog) and a template root (`source.root`, usually `./template`). An architecture pack needs `manifest.yaml` plus the declared layout/tree/conventions files.

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

Après create avec ce preset : lancer `/setup-matt-pocock-skills` une fois dans ton agent.

## Project types

| Id | Stacks | Unlocks (interactive) |
|---|---|---|
| `ts-lib` | `lib`, `typescript` | general agents only |
| `react-next` | `react`, `next`, `web`, `ui`, `typescript` | Hallmark, Vercel React/Next skills, React Doctor |
| `laravel-app` | `laravel`, `php` | Laravel pack |

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

v0.4: GitHub download + cache, stack-filtered agent selection, remote skill/guidelines install, user catalog + `ark add project`.
