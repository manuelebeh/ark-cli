from {{project_name}}.core import greet


def test_greet() -> None:
    assert greet("ark") == "Hello, ark"
