# Flutter feature-first

Product behavior lives under `lib/features/<name>/`. Cross-cutting code lives under `lib/shared/`.
`lib/main.dart` wires the app and composes features.

## Rules of thumb

1. New product capability → new or existing **feature**, not a global widgets dump.
2. A feature may expose a **public API** (`index.dart`); other features import that only when needed.
3. `lib/shared/` holds utilities, theme helpers, and reusable widgets, not feature domain logic.
4. Prefer colocated tests inside the feature or under `test/features/<name>/`.
5. Do not add a top-level `lib/widgets/` tree; put reusable UI in `lib/shared/widgets/`.

## Typical shape

```text
lib/
  main.dart
  core/
  features/
    greeter/
      domain/
      data/
      presentation/
      index.dart
  shared/
    lib/
    widgets/
test/
pubspec.yaml
```
