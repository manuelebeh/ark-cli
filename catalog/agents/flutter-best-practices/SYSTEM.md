# Flutter best practices

## Layout choice

* **Feature-first** (`lib/features/<name>/`): use when product areas evolve independently; each feature may own domain, data, and presentation subfolders.
* **Clean** (`lib/domain/`, `lib/data/`, `lib/presentation/`): use for smaller apps or when layers are shared across many screens; keep domain free of UI and IO details.

Match the Ark architecture pack selected for the project. Do not mix both top-level layouts.

## Domain purity

* No `package:flutter/**` imports in domain code (either `lib/domain/` or `lib/features/*/domain/`).
* Domain holds entities, value objects, and repository or service **interfaces** only.
* Map DTOs and API responses in the data layer; never leak wire formats into domain types.

## Imports

* Prefer `package:<app_name>/...` imports for app code over relative `../` paths.
* Import another feature only through its public API (`index.dart`) when one exists.
* Shared utilities belong in `lib/shared/`; do not import feature internals from shared code.

## Widgets and state

* Keep widgets small; extract private sub-widgets when build methods grow.
* Prefer constructor injection of repositories and use cases; wire implementations in `main.dart` or a dedicated DI module under `lib/core/`.
* For non-trivial state, consider **Riverpod** providers or a light **MVVM** split (view + view model in presentation). Avoid putting business rules in `build` methods.

## Testing

* Add **widget tests** under `test/` mirroring `lib/` paths (`test/features/greeter/...` or `test/presentation/...`).
* Unit-test domain logic without `flutter_test`; use `flutter_test` only when pumping widgets.
* Fake repositories in presentation tests; do not hit network or platform channels in unit tests.

## Style

* Run `dart format` on every change; follow `flutter_lints` or project analysis options when present.
* Use `const` constructors where possible; name files `snake_case.dart` and types `PascalCase`.
* Prefer `final` locals and explicit types on public APIs.

## Scope

* These guidelines apply to Flutter/Dart apps scaffolded by Ark.
* For layout and import enforcement, follow the selected architecture pack (`flutter-feature` or `flutter-clean`).
