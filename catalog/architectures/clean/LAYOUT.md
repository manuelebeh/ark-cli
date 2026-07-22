# Clean architecture

Entities and domain rules sit in `domain/`. Use cases live in `application/`.
Frameworks, persistence, and delivery mechanisms live in `infrastructure/`.

## Rules of thumb

1. `domain/` imports nothing from `application/` or `infrastructure/`.
2. `application/` may depend on `domain/` only (not infrastructure).
3. `infrastructure/` depends inward (implements repositories, controllers, etc.).
4. `shared/` is for cross-cutting utilities, not domain logic.

## Typical shape

```text
domain/
application/
infrastructure/
shared/               # optional
```
