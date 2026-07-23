# Rust hexagonal

Ports and adapters under `src/`: pure domain, use cases in application, adapters at the edge.

## Rules of thumb

1. Domain stays pure; no adapter or framework imports.
2. Application defines ports (traits) and orchestrates use cases.
3. Adapters drive or serve the application (CLI, HTTP, DB, external APIs).
4. Keep `main.rs` thin; wire adapters and use cases in main.

## Typical shape

```text
src/
  main.rs
  domain/
  application/
  adapters/
Cargo.toml
```
