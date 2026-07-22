# Hexagonal (ports & adapters)

Domain stays free of frameworks. Application orchestrates use cases and declares ports.
Concrete I/O lives under adapters.

## Rules of thumb

1. `domain/` has no imports from `application/` or `adapters/`.
2. `application/` depends on domain and port interfaces only, not adapter implementations.
3. `adapters/inbound/` (HTTP, CLI, UI) and `adapters/outbound/` (DB, HTTP clients) implement ports.
4. `shared/` is for cross-cutting utilities, not domain logic.

## Typical shape

```text
domain/
application/          # use cases + port interfaces
adapters/
  inbound/
  outbound/
shared/               # optional
```
