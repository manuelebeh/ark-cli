class Greeting {
  const Greeting({required this.message});

  final String message;

  static Greeting format(String name) {
    return Greeting(message: 'Hello, $name');
  }
}
