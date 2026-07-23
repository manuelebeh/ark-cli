# PHP hexagonal

Framework-free hexagonal layout (ports & adapters): pure `Domain/`, use cases in `Application/`, adapters in `Infrastructure/`.

## Rules of thumb

1. Domain imports nothing from infrastructure or frameworks.
2. Application depends on Domain + ports (interfaces).
3. Infrastructure implements ports (HTTP, CLI, DB, external APIs).
4. Enforce with Deptrac / PHPArkitect in larger projects.

## Typical shape

```text
src/
  Domain/
  Application/
  Infrastructure/
public/
composer.json
```
