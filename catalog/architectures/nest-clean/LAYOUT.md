# NestJS clean architecture

Clean layers under `src/`: domain at the center, application use cases, Nest delivery in infrastructure.

## Rules of thumb

1. `src/domain/` has no Nest or outer-layer imports.
2. `src/application/` depends on domain only (not infrastructure).
3. `src/infrastructure/` hosts Nest controllers/modules and other adapters; depends inward.
4. Cross-cutting helpers live in `shared/` or `src/common/`.

## Typical shape

```text
src/
  domain/
  application/
  infrastructure/
    http/
  common/           # optional
  main.ts
  app.module.ts
shared/             # optional
```
