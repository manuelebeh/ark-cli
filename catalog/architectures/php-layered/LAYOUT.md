# PHP layered

Classic vanilla PHP layering (no framework): thin controllers, services for business logic, repositories for persistence, models for data shapes.

## Rules of thumb

1. Controllers handle HTTP/CLI I/O only.
2. Services own business rules.
3. Repositories own storage access.
4. Keep PSR-4 under `src/` with Composer.

## Typical shape

```text
src/
  Controller/
  Service/
  Repository/
  Model/
public/
composer.json
```
