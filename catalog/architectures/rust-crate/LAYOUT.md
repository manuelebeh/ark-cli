# Rust crate

Standard Cargo binary crate: source under `src/`, optional integration tests, benchmarks, examples, and docs.

## Rules of thumb

1. Keep `src/main.rs` (or `src/lib.rs`) as the crate root; split logic into modules under `src/`.
2. Put integration tests in `tests/`; unit tests colocate in source files with `#[cfg(test)]`.
3. Use `examples/` for runnable samples and `benches/` for Criterion-style benchmarks.
4. Optional `docs/` for extra project documentation beyond rustdoc.

## Typical shape

```text
src/
  main.rs
  greeter.rs
tests/
Cargo.toml
```
