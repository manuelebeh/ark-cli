import 'package:{{project_name}}/domain/greeting.dart';

abstract class GreetingRepository {
  Greeting fetch(String name);
}

class InMemoryGreetingRepository implements GreetingRepository {
  @override
  Greeting fetch(String name) => Greeting.format(name);
}
