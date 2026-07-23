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
| Architecture | Contract (`feature-first`, `hexagonal`, `clean`, Laravel / Django / FastAPI variants, …): layout, naming, forbidden paths, import rules |
| Project type | Template that implements an architecture (+ stack tags) |
| Agent | Portable pack: local manifest, remote guidelines, Agent Skills, or tool-skills |

At `ark create`, you pick a **language** first (PHP, Python, TypeScript, …), then a **framework** family for that language (Laravel, Django, FastAPI, …), then an **architecture**. Custom arches go in the user catalog (`ark add architecture`); `create` and `check` read them from the registry with no special-case code.

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
node dist/cli.js create demo --stack lib,typescript --architecture feature-first --agents karpathy,feature-owner
node dist/cli.js create hex --stack lib,typescript --architecture hexagonal
node dist/cli.js create clean-demo --stack lib,typescript --architecture clean
node dist/cli.js create web --project react-next
node dist/cli.js create api --stack laravel,php --architecture laravel-ddd --depth minimal
node dist/cli.js create api-full --stack laravel,php --architecture laravel-ddd --depth full --bootstrap ddev
node dist/cli.js create api-vsa --stack laravel,php --architecture laravel-vertical-slice --depth minimal
node dist/cli.js create dj --stack django,python --architecture django-services --depth minimal
node dist/cli.js create dj-full --stack django,python --architecture django-ddd --depth full --bootstrap uv
node dist/cli.js create fa --stack fastapi,python --architecture fastapi-modules --depth minimal
node dist/cli.js create fa-full --stack fastapi,python --architecture fastapi-clean --depth full --bootstrap uv
node dist/cli.js create php-app --language php --stack php --architecture php-hexagonal --depth minimal
node dist/cli.js create py-app --language python --stack python --architecture python-src --depth minimal
node dist/cli.js check ./demo
node dist/cli.js check --json
node dist/cli.js check --format sarif
```

`--project` alone skips language/framework/architecture prompts (architecture is derived). `--language` / `-l` picks the language bucket (e.g. `python`). `--stack` accepts a full tag set (`laravel,php`), a language (`python`), or a framework tag (`django`). `--architecture` / `--arch` then picks among templates for that family.

On Laravel, Django, FastAPI, plain PHP, and plain Python stacks, `--depth minimal|full` chooses an Ark skeleton or a real tool bootstrap. Full mode also needs `--bootstrap`:

- Laravel: `laravel-installer` | `composer` | `sail` | `ddev`
- Django: `uv` | `host` | `poetry` | `cookiecutter-django` | `django-admin`
- FastAPI: `uv` | `host` | `poetry` | `cookiecutter`
- PHP (no framework): `composer` | `host`
- Python (no framework): `uv` | `host` | `poetry`

In non-interactive shells (no TTY), pass required flags (`name`, `--project`, or `--language`/`--stack` + `--architecture`, etc.). Agent prompts are skipped (no agents) unless you pass `--agents` / `--preset`. Cancelled prompts exit with code `1`.

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
ark add architecture ./my-arch --id my-arch
ark add project ./pack --id mon-stack --architecture my-arch
ark list
ark create app --stack <tags> --architecture my-arch --project mon-stack
ark check ./app
ark check --json
ark check --format sarif

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
| `laravel-folder-by-feature` | `app/{Feature}/` with Controllers, Models, Routes |
| `laravel-vertical-slice` | `app/Features/{Slice}/` with `Action.php` entrypoint |
| `laravel-nwidart` | `Modules/{Module}/` via nwidart/laravel-modules |
| `laravel-internachi` | `app-modules/{module}/` Composer path packages |
| `laravel-ddd` | `app/Domains/{Domain}/{Domain,Application,Infrastructure}/` |
| `django-apps` | `apps/{app}/` with `models.py` + `apps.py` |
| `django-services` | `apps/{app}/` with `services.py` + `selectors.py` |
| `django-rapid` | RAPID: `data/`, `interfaces/`, `readers/`, `actions/` |
| `django-ddd` | `domains/{domain}/{domain,application,infrastructure}/` |
| `fastapi-tiangolo` | `app/api/`, `app/crud.py`, `app/models.py`, `app/core/` |
| `fastapi-layered` | `api/`, `services/`, `repositories/`, `models/`, `schemas/` |
| `fastapi-modules` | `src/{feature}/` with `router.py` + `service.py` |
| `fastapi-clean` | `domain/`, `application/`, `infrastructure/`, `presentation/` |
| `php-layered` | Vanilla PHP: `src/{Controller,Service,Repository,Model}/` |
| `php-hexagonal` | Vanilla PHP: `src/{Domain,Application,Infrastructure}/` |
| `php-feature` | Vanilla PHP: `src/Features/{Feature}/Action.php` |
| `python-src` | PyPA `src/{package}/` library/CLI layout |
| `python-clean` | `domain/`, `application/`, `infrastructure/` |
| `python-hexagonal` | `domain/`, `application/`, `adapters/` |
| `python-feature` | `features/{feature}/` public `__init__.py` |

## Project types

| Id | Architecture | Stacks | Unlocks (interactive) |
|---|---|---|---|
| `ts-lib` | feature-first | `lib`, `typescript` | general agents only |
| `ts-lib-hexagonal` | hexagonal | `lib`, `typescript` | general agents only |
| `ts-lib-clean` | clean | `lib`, `typescript` | general agents only |
| `react-next` | feature-first | `react`, `next`, `web`, `ui`, `typescript` | Hallmark, Vercel React/Next skills, React Doctor |
| `laravel-folder-by-feature` | laravel-folder-by-feature | `laravel`, `php` | Laravel pack |
| `laravel-vertical-slice` | laravel-vertical-slice | `laravel`, `php` | Laravel pack |
| `laravel-nwidart` | laravel-nwidart | `laravel`, `php` | Laravel pack |
| `laravel-internachi` | laravel-internachi | `laravel`, `php` | Laravel pack |
| `laravel-ddd` | laravel-ddd | `laravel`, `php` | Laravel pack |
| `django-apps` | django-apps | `django`, `python` | Django pack |
| `django-services` | django-services | `django`, `python` | Django pack |
| `django-rapid` | django-rapid | `django`, `python` | Django pack |
| `django-ddd` | django-ddd | `django`, `python` | Django pack |
| `fastapi-tiangolo` | fastapi-tiangolo | `fastapi`, `python` | FastAPI pack |
| `fastapi-layered` | fastapi-layered | `fastapi`, `python` | FastAPI pack |
| `fastapi-modules` | fastapi-modules | `fastapi`, `python` | FastAPI pack |
| `fastapi-clean` | fastapi-clean | `fastapi`, `python` | FastAPI pack |
| `php-layered` | php-layered | `php` | Vanilla PHP |
| `php-hexagonal` | php-hexagonal | `php` | Vanilla PHP |
| `php-feature` | php-feature | `php` | Vanilla PHP |
| `python-src` | python-src | `python` | Vanilla Python |
| `python-clean` | python-clean | `python` | Vanilla Python |
| `python-hexagonal` | python-hexagonal | `python` | Vanilla Python |
| `python-feature` | python-feature | `python` | Vanilla Python |

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

## CI (`ark check`)

Machine-readable output for pipelines (no Clack text):

```bash
ark check --json
ark check --format sarif
```

Exit `1` when any issue has severity `error`; warnings alone exit `0`.

Composite GitHub Action:

```yaml
- uses: manuelebeh/ark-cli/.github/actions/ark-check@v0.5.0
  with:
    path: .
    format: json
```

Inputs: `path` (default `.`), `format` (`json` | `sarif` | `text`), optional `catalog`, `version` (npm `ark` version, default `0.5.0`). Example workflow: [`.github/workflows/ark-check.yml.example`](.github/workflows/ark-check.yml.example).

## Status

v0.5: Django + FastAPI catalog packs (eight architectures), Python import checking, shared depth/bootstrap (`uv` / `host` / `poetry` / cookiecutter / `django-admin`), `ark check --json` / `--format sarif`, GitHub Action. v0.4: GitHub download + cache, stack-filtered agent selection, remote skill/guidelines install, user catalog + `ark add`, multi-architecture create (`feature-first`, `hexagonal`, `clean`, five Laravel approaches), optional `--run-postinstall`.
