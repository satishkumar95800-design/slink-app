import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

// Placeholder page — replace with real screens
class PlaceholderPage extends StatelessWidget {
  final String name;
  const PlaceholderPage(this.name, {super.key});

  @override
  Widget build(BuildContext context) =>
      Scaffold(appBar: AppBar(title: Text(name)), body: Center(child: Text(name)));
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const PlaceholderPage('Login')),
      GoRoute(path: '/dashboard', builder: (_, __) => const PlaceholderPage('Dashboard')),
      GoRoute(path: '/fees', builder: (_, __) => const PlaceholderPage('Fees')),
      GoRoute(path: '/reports', builder: (_, __) => const PlaceholderPage('Reports')),
    ],
  );
});
