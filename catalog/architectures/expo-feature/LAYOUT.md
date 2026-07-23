# Expo feature-first

Domain behavior lives under `src/features/<name>/`. Cross-cutting code lives under `src/shared/`.
Expo Router screens live under `src/app/` and compose features.

## Rules of thumb

1. New product capability → new or existing **feature**, never a global services dump.
2. A feature exposes a **public API** (`index.ts`). Screens and other features import that only.
3. `src/shared/` is for UI primitives, config, and utilities, not domain logic.
4. Prefer colocated tests inside the feature.

## Typical shape

```text
src/
  app/
    _layout.tsx
    index.tsx
  features/
    greeter/
      index.ts
      Greeter.tsx
  shared/
    lib/
```
