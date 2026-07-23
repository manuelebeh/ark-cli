import 'package:{{project_name}}/domain/greeting.dart';
import 'package:flutter/material.dart';

class GreeterPage extends StatelessWidget {
  const GreeterPage({super.key, required this.greeting});

  final Greeting greeting;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text(greeting.message),
      ),
    );
  }
}
