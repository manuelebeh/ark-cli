import 'package:{{project_name}}/data/greeting_repository.dart';
import 'package:{{project_name}}/presentation/greeter_page.dart';
import 'package:flutter/material.dart';

void main() {
  runApp(MyApp(repository: InMemoryGreetingRepository()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.repository});

  final GreetingRepository repository;

  @override
  Widget build(BuildContext context) {
    final greeting = repository.fetch('world');
    return MaterialApp(
      title: '{{project_name}}',
      home: GreeterPage(greeting: greeting),
    );
  }
}
