import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/student.dart';
import '../auth/session_controller.dart';
import 'students_repository.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(myChildrenProvider);
    final user = ref.watch(sessionControllerProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: Text(user != null ? 'Hi, ${user.name}' : 'School Connect'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(sessionControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: childrenAsync.when(
        data: (children) {
          if (children.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  "No children are linked to your account yet. Please contact the school office.",
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return _DashboardBody(children: children);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Could not load your children.\n$error', textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}

class _DashboardBody extends ConsumerWidget {
  final List<Student> children;

  const _DashboardBody({required this.children});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedChildId = ref.watch(selectedChildIdProvider);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (children.length > 1) ...[
            Text('Children', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: selectedChildId == null,
                  onSelected: (_) => ref.read(selectedChildIdProvider.notifier).state = null,
                ),
                for (final child in children)
                  ChoiceChip(
                    label: Text(child.name),
                    selected: selectedChildId == child.id,
                    onSelected: (_) => ref.read(selectedChildIdProvider.notifier).state = child.id,
                  ),
              ],
            ),
            const SizedBox(height: 24),
          ] else if (children.length == 1) ...[
            Text(children.first.name, style: Theme.of(context).textTheme.titleLarge),
            Text(children.first.studentClass?.name ?? ''),
            const SizedBox(height: 24),
          ],
          _NavCard(
            icon: Icons.receipt_long,
            title: 'Fees',
            subtitle: 'View dues and pay online',
            onTap: () => context.push('/dashboard/fees'),
          ),
          const SizedBox(height: 12),
          _NavCard(
            icon: Icons.assignment,
            title: 'Reports',
            subtitle: 'Academic and homework updates from teachers',
            onTap: () => context.push('/dashboard/reports'),
          ),
        ],
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _NavCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: Icon(icon, size: 32),
        title: Text(title, style: Theme.of(context).textTheme.titleMedium),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
