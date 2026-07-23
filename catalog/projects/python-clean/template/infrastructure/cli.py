from application.greet import greet


def main() -> None:
    print(greet("world").text)


if __name__ == "__main__":
    main()
