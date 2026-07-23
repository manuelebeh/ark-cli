# Python hexagonal

Ports & adapters without a web framework: domain + application in the center, adapters at the edge (CLI, files, HTTP clients, DB).

## Rules of thumb

1. Domain stays pure.
2. Application defines ports (interfaces / protocols) and use cases.
3. Adapters implement inbound (CLI) and outbound (storage, APIs) ports.
4. Shared helpers in `shared/`.

## Typical shape

```text
domain/
application/
adapters/
  inbound/
  outbound/
shared/
```
