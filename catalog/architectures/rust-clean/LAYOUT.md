# Rust clean architecture

Clean layers under `src/`: pure domain, use cases in application, I/O adapters in infrastructure. `main.rs` wires the binary.

## Rules of thumb

1. Domain imports nothing from application or infrastructure.
2. Application depends on domain types and defines ports (traits).
3. Infrastructure implements ports (console, HTTP, DB, external APIs).
4. Keep `main.rs` thin; compose layers in main or a small wiring module.

## Typical shape

```text
src/
  main.rs
  domain/
  application/
  infrastructure/
Cargo.toml
```
