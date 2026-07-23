# PHP feature folders

Vertical slices under `src/Features/{Feature}/`. Cross-feature access goes through each feature's public API class.

## Rules of thumb

1. New capability → new feature folder.
2. Prefer colocating domain + application glue inside the feature.
3. Shared kernel code lives in `src/Shared/`.

## Typical shape

```text
src/
  Features/
    Greet/
      Greet.php
  Shared/
composer.json
```
