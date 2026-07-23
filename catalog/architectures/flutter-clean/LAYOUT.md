# Flutter clean architecture

Classic clean layers: pure `lib/domain/`, adapters in `lib/data/`, UI in `lib/presentation/`.

## Rules of thumb

1. Domain has no Flutter, HTTP, or persistence imports.
2. Data implements repositories and maps external models to domain types.
3. Presentation depends on domain abstractions; wire concrete data implementations in `main.dart` or DI.
4. Optional `lib/shared/` holds theme, constants, and small utilities usable from any layer.

## Typical shape

```text
lib/
  main.dart
  domain/
  data/
  presentation/
  core/
  shared/
test/
pubspec.yaml
```
