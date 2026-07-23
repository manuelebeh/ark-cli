# Python feature packages

Vertical features under `features/{feature}/` (no web framework). Public API via `__init__.py`.

## Rules of thumb

1. New capability → new feature package.
2. Cross-feature imports go through `__init__.py`.
3. Shared helpers in `shared/`.

## Typical shape

```text
features/
  greeter/
    __init__.py
    core.py
shared/
pyproject.toml
```
