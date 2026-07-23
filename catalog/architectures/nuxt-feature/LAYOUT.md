# Nuxt feature-first

Domain behavior lives under `app/features/<name>/`. Anything truly cross-cutting lives under `shared/`.

## Rules of thumb

1. New product capability → new or existing **feature**, never a global services dump.
2. A feature exposes a **public API** (`index.ts`). Other features import that only.
3. `shared/` is for UI primitives, config, and utilities, not domain logic.
4. Pages under `app/pages/` compose features; they are not features themselves.

## Typical feature shape

```text
app/
  features/
    greeter/
      index.ts
      GreeterMessage.vue
  pages/
    index.vue
shared/
  lib/
```
