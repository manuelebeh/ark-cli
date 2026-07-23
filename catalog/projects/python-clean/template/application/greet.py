from domain.greeting import Greeting


def greet(name: str) -> Greeting:
    return Greeting(text=f"Hello, {name}")
