def assert_true(value: bool, message: str = "assertion failed") -> None:
    if not value:
        raise AssertionError(message)
