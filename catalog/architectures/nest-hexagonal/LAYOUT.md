# NestJS hexagonal (ports & adapters)

Domain stays free of Nest. Application orchestrates use cases and declares ports.
Concrete I/O lives under `src/adapters/`.

## Rules of thumb

1. `src/domain/` has no imports from application or adapters.
2. `src/application/` depends on domain and port interfaces only.
3. `src/adapters/inbound/` (HTTP Nest modules) and `src/adapters/outbound/` implement ports.
4. Do not use a parallel `src/infrastructure/` tree; adapters are the edge.

## Typical shape

```text
src/
  domain/
  application/
  adapters/
    inbound/
      http/
    outbound/
  common/           # optional
  main.ts
  app.module.ts
shared/             # optional
```
