import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/student_fee.dart';
import 'fees_providers.dart';

class FeesListPage extends ConsumerWidget {
  const FeesListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feesAsync = ref.watch(studentFeesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Fees')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(studentFeesProvider),
        child: feesAsync.when(
          data: (fees) {
            if (fees.isEmpty) {
              return const Center(child: Text('No fees found.'));
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: fees.length,
              itemBuilder: (context, index) => _FeeCard(fee: fees[index]),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load fees. Pull down to retry.\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeeCard extends StatelessWidget {
  final StudentFee fee;

  const _FeeCard({required this.fee});

  Color _statusColor() {
    switch (fee.status) {
      case FeeStatus.paid:
        return Colors.green;
      case FeeStatus.overdue:
        return Colors.red;
      case FeeStatus.partial:
        return Colors.orange;
      case FeeStatus.waived:
        return Colors.grey;
      case FeeStatus.pending:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPay = fee.outstanding > 0 && fee.status != FeeStatus.waived;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    fee.feeStructure.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: _statusColor().withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    fee.status.name.toUpperCase(),
                    style: TextStyle(color: _statusColor(), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('${fee.student.name} • Due ${fee.dueDate.toLocal().toString().split(' ').first}'),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  canPay ? '₹${fee.outstanding.toStringAsFixed(2)} due' : 'Paid in full',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                if (canPay)
                  FilledButton(
                    onPressed: () => context.push('/fees/${fee.id}/pay'),
                    child: const Text('Pay now'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
