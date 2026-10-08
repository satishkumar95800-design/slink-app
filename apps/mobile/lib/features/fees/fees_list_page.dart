import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/student_fee.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'fees_providers.dart';
import '../../core/format/money.dart';
import '../../core/strings.dart';
import '../../shared/models/payment_claim.dart';
import '../dashboard/students_repository.dart';
import '../home/parent_home_models.dart';
import '../payment_claims/my_payment_claims_page.dart';

class FeesListPage extends ConsumerWidget {
  const FeesListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feesAsync = ref.watch(studentFeesProvider);
    final selectedChildId = ref.watch(selectedChildIdProvider);
    // The parent's claims for the selected child, shown under the fees (§3.4).
    final claims = (ref.watch(myPaymentClaimsProvider).valueOrNull ?? const <PaymentClaim>[])
        .where((c) => selectedChildId == null || c.student.id == selectedChildId)
        .toList();

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text(AppStrings.menuFees)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(studentFeesProvider);
          ref.invalidate(myPaymentClaimsProvider);
        },
        child: feesAsync.when(
          data: (fees) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (fees.isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: Text(AppStrings.noFees))),
                for (final fee in fees) _FeeCard(fee: fee),
                if (claims.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(AppStrings.myClaims, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  for (final claim in claims) PaymentClaimCard(claim: claim),
                ],
              ],
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
    final hasReceipt = fee.status == FeeStatus.paid || fee.status == FeeStatus.partial;

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
            Text('${fee.student.name} • ${AppStrings.dueOn(displayDate(fee.dueDate))}'),
            const SizedBox(height: 12),
            Text(
              canPay ? AppStrings.amountDue(formatRupees(fee.outstanding)) : AppStrings.paidInFull,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            if (canPay) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.push('/fees/${fee.id}/pay'),
                child: const Text(AppStrings.payOnline),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => context.push('/fees/${fee.id}/claim', extra: fee.outstanding),
                child: const Text(AppStrings.paidByCashOrCheque, textAlign: TextAlign.center),
              ),
            ],
            if (hasReceipt)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => context.push('/fees/${fee.id}/receipts'),
                  icon: const Icon(Icons.receipt_outlined),
                  label: const Text(AppStrings.viewReceipts),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
