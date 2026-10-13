import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/student_fee.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'fees_providers.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import 'fee_labels.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/ui_kit.dart';
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
    final l = context.l10n;

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.menuFees)),
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
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 64),
                    child: Column(children: [
                      const IconBadge(icon: Icons.verified_rounded, color: FeatureColors.attendance, size: 84),
                      const SizedBox(height: 20),
                      Text(l.feesEmpty, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                    ]),
                  ),
                for (final fee in fees) _FeeCard(fee: fee),
                if (claims.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SectionHeader(title: l.feesMyClaims),
                  for (final claim in claims) PaymentClaimCard(claim: claim),
                ],
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('${l.feesCouldNotLoad}\n$error', textAlign: TextAlign.center),
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
        return FeatureColors.attendance;
      case FeeStatus.overdue:
        return const Color(0xFFDC2626);
      case FeeStatus.partial:
        return FeatureColors.fees;
      case FeeStatus.waived:
        return FeatureColors.sent;
      case FeeStatus.pending:
        return FeatureColors.timetable;
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPay = fee.outstanding > 0 && fee.status != FeeStatus.waived;
    final hasReceipt = fee.status == FeeStatus.paid || fee.status == FeeStatus.partial;
    final l = context.l10n;
    final theme = Theme.of(context);
    final color = _statusColor();
    final paidFraction = fee.amountDue <= 0 ? 1.0 : fee.amountPaid / fee.amountDue;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IconBadge(
                  icon: fee.status == FeeStatus.paid ? Icons.verified_rounded : Icons.account_balance_wallet_rounded,
                  color: fee.status == FeeStatus.paid ? FeatureColors.attendance : FeatureColors.fees,
                  size: 48,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(fee.feeStructure.name,
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      Text('${fee.student.name} • ${l.feesDueOn(displayDate(fee.dueDate))}',
                          style: theme.textTheme.bodySmall),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusPill(label: feeStatusLabel(l, fee.status), color: color),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              canPay ? l.feesAmountDue(formatRupees(fee.outstanding)) : l.feesPaidInFull,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: fee.status == FeeStatus.overdue ? color : null,
              ),
            ),
            if (fee.status != FeeStatus.waived) ...[
              const SizedBox(height: 10),
              RoundedBar(value: paidFraction, color: FeatureColors.attendance, height: 8),
            ],
            if (canPay) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => context.push('/fees/${fee.id}/pay'),
                icon: const Icon(Icons.bolt_rounded, size: 20),
                label: Text(l.feesPayOnline),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => context.push('/fees/${fee.id}/claim', extra: fee.outstanding),
                child: Text(l.feesPaidByCashOrCheque, textAlign: TextAlign.center),
              ),
            ],
            if (hasReceipt)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => context.push('/fees/${fee.id}/receipts'),
                  icon: const Icon(Icons.receipt_long_rounded),
                  label: Text(l.feesReceipts),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
