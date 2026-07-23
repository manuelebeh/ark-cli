import 'package:flutter/material.dart';

class GreeterPage extends StatelessWidget {
  const GreeterPage({super.key, this.name = 'world'});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('Hello, $name'),
      ),
    );
  }
}
