# NestJS feature modules

Nest feature modules under `src/{feature}/`. Each feature owns its module, controller, and service (plus optional `dto/`, `entities/`).

## Rules of thumb

1. New capability → new package under `src/`.
2. Cross-feature access goes through that feature's `*.module.ts` (or `index.ts`) public surface.
3. Shared cross-cutting code lives in `shared/`, not inside a random feature.
4. Do not dump global `controllers/`, `services/`, or `repositories/` under `src/`.

## Typical shape

```text
src/
  main.ts
  app.module.ts
  greeter/
    greeter.module.ts
    greeter.controller.ts
    greeter.service.ts
    dto/
    entities/
shared/
```
