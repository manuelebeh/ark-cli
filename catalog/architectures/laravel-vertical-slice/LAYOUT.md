# Laravel vertical slice

Each user-facing use case is a slice under `app/Features/{Slice}/`. Related HTTP and application code stay together.

## Rules of thumb

1. New use case → new **slice** folder. Do not grow a shared Controllers dump.
2. Every slice exposes `Action.php` as the application entrypoint (public API for other slices).
3. Shared Eloquent models may live under `app/Models/`; domain-specific logic stays in the slice.
4. Prefer colocated tests inside the slice.

## Typical slice shape

```text
app/
  Features/
    RegisterAccount/
      Action.php
      Controller.php
      Request.php
  Models/
```

Name the folder after the use case (`RegisterAccount`, `PlaceOrder`). Keep `Action.php` as the required entrypoint so `arkctl check` can enforce the contract.
