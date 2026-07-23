# Python src package

Standard `src/{package}/` layout (PyPA packaging guide, `uv init --lib` / `--package`). Keeps importable code off the repo root so tests run against the installed package.

## Rules of thumb

1. Put the import package under `src/{package_name}/`.
2. Keep `tests/` at the repo root (mirror the package).
3. Public API via `__init__.py`; optional `__main__.py` for `python -m`.
4. Configure packaging in `pyproject.toml` (PEP 621).

## Typical shape

```text
src/
  mypkg/
    __init__.py
    __main__.py
    core.py
tests/
pyproject.toml
```
