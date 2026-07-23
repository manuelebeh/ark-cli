# Rust best practices

## Modules & layout

* One crate root per binary (`src/main.rs`) or library (`src/lib.rs`); declare submodules with `mod` in the root or parent `mod.rs`
* Keep `main` thin: parse CLI args, wire dependencies, call into application or adapter modules
* Prefer `crate::` paths for internal imports; use `pub use` sparingly at module boundaries to expose a stable API
* Colocate unit tests in source files with `#[cfg(test)] mod tests`; put integration tests in `tests/`

## Result & Option

* Use `Result<T, E>` for fallible operations; prefer concrete error types or `thiserror` over stringly-typed errors in libraries
* Propagate errors with `?`; add context with `.map_err` or an error-attachment crate when the call site lacks detail
* Use `Option<T>` for absent values, not sentinel strings or magic numbers
* Avoid `unwrap` and `expect` in library code; reserve them for prototypes, tests, or invariants documented at the call site

## Ownership & borrowing

* Prefer borrowing (`&T`, `&mut T`) over cloning when callers can lend data
* Clone deliberately when ownership transfer is required; do not clone to silence the borrow checker
* Use owned types at module boundaries when lifetimes would leak across layers (domain/application/infrastructure)

## Tooling

* Run `cargo fmt` on every change; match existing formatting in the crate
* Run `cargo clippy` and address warnings; allow lints only with a brief comment when justified
* Keep `Cargo.toml` dependencies minimal; pin versions for applications, semver ranges for libraries as appropriate

## Layer boundaries

* Domain modules must not import application, infrastructure, or adapter code
* Application depends on domain types and defines ports (traits); it must not import concrete adapters
* Infrastructure or adapters implement ports and may depend on application and domain
* `main.rs` is the composition root: it may import any layer for wiring only

## Scope

* These guidelines are framework-agnostic Rust
* For Ark layout rules, follow the selected architecture pack (rust-crate, rust-clean, rust-hexagonal)
