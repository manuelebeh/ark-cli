# Python clean architecture

Classic clean layers without Django/FastAPI: `domain/`, `application/`, `infrastructure/`.

## Rules of thumb

1. Domain has no I/O or framework imports.
2. Application orchestrates use cases against domain types.
3. Infrastructure adapters (CLI, DB, HTTP clients) sit outside.
4. Shared helpers in `shared/`.

## Typical shape

```text
domain/
application/
infrastructure/
shared/
pyproject.toml
```
