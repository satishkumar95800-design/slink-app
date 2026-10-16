import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'apply_leave_page.dart';
import 'hrms_models.dart';
import 'hrms_repository.dart';
import 'hrms_widgets.dart';

/// Leave balances per type and the teacher's own requests, with apply and cancel.
class LeavePage extends ConsumerWidget {
  const LeavePage({super.key});

  Future<void> _cancel(BuildContext context, WidgetRef ref, LeaveRequest r) async {
    final l = context.l10n;
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(l.hrmsCancelConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.hrmsKeepRequest)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.hrmsCancelRequest)),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(hrmsRepositoryProvider).cancel(r.id);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(describeLeaveError(e))));
    }
    ref.invalidate(leaveRequestsProvider);
    ref.invalidate(leaveBalancesProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final balances = ref.watch(leaveBalancesProvider);
    final requests = ref.watch(leaveRequestsProvider);
    final today = DateTime.now();

    Future<void> refresh() async {
      ref.invalidate(leaveBalancesProvider);
      ref.invalidate(leaveRequestsProvider);
      await ref.read(leaveRequestsProvider.future).catchError((_) => <LeaveRequest>[]);
    }

    final firstError = balances.hasError ? balances.error : (requests.hasError ? requests.error : null);

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.hrmsLeaveTitle)),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: firstError != null
            ? HrmsError(error: firstError, onRetry: refresh)
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  FilledButton.icon(
                    onPressed: () async {
                      final sent = await Navigator.of(context).push<bool>(
                        MaterialPageRoute<bool>(builder: (_) => const ApplyLeavePage()),
                      );
                      if (sent == true) await refresh();
                    },
                    icon: const Icon(Icons.add_rounded),
                    label: Text(l.hrmsApplyLeave),
                  ),
                  const SizedBox(height: 12),
                  SectionHeader(title: l.hrmsBalances),
                  balances.when(
                    loading: () => const LoadingBlock(height: 120),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (list) => Column(children: [for (final b in list) _BalanceCard(balance: b)]),
                  ),
                  const SizedBox(height: 12),
                  SectionHeader(title: l.hrmsRequests),
                  requests.when(
                    loading: () => const LoadingBlock(height: 120),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (list) => list.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: Text(l.hrmsNoRequests, textAlign: TextAlign.center),
                          )
                        : Column(children: [
                            for (final r in list)
                              _RequestCard(request: r, canCancel: r.canCancel(today), onCancel: () => _cancel(context, ref, r)),
                          ]),
                  ),
                ],
              ),
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  final LeaveBalance balance;

  const _BalanceCard({required this.balance});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return ListCard(
      leading: const IconBadge(icon: Icons.beach_access_rounded, color: FeatureColors.attendance, size: 44),
      title: balance.isPaid ? balance.name : '${balance.name} (${l.hrmsUnpaidLeave})',
      subtitle: l.hrmsBalanceDetail(
        formatDays(balance.allowance),
        formatDays(balance.carriedIn),
        formatDays(balance.used),
        formatDays(balance.pending),
      ),
      subtitleLines: 3,
      trailing: balance.isPaid
          ? Text(l.hrmsAvailable(formatDays(balance.available)),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800))
          : null,
    );
  }
}

class _RequestCard extends StatelessWidget {
  final LeaveRequest request;
  final bool canCancel;
  final VoidCallback onCancel;

  const _RequestCard({required this.request, required this.canCancel, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final r = request;
    final range = r.fromDate == r.toDate ? displayYmd(r.fromDate) : '${displayYmd(r.fromDate)} - ${displayYmd(r.toDate)}';
    final days = r.halfDay ? l.hrmsHalfDayLabel : l.hrmsDaysCount(formatDays(r.days));
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(r.typeName, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
              StatusPill(label: r.status.label(context), color: r.status.color),
            ]),
            const SizedBox(height: 4),
            Text('$range · $days'),
            if (r.reason.isNotEmpty) Text(r.reason, style: Theme.of(context).textTheme.bodySmall),
            if (r.decisionNote != null && r.decisionNote!.isNotEmpty)
              Text(l.hrmsDecisionNote(r.decisionNote!), style: Theme.of(context).textTheme.bodySmall),
            if (canCancel)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton(onPressed: onCancel, child: Text(l.hrmsCancelRequest)),
              ),
          ],
        ),
      ),
    );
  }
}

/// Friendly, translated text for leave API errors; falls back to the generic description.
String describeLeaveError(Object e) {
  final l = currentL10n;
  final code = e is ApiException ? e.code : _codeOf(e);
  return switch (code) {
    'INSUFFICIENT_BALANCE' => l.hrmsErrInsufficientBalance,
    'LEAVE_OVERLAP' => l.hrmsErrOverlap,
    'NO_WORKING_DAYS' => l.hrmsErrNoWorkingDays,
    'NO_EMPLOYEE_RECORD' => l.hrmsErrNoRecord,
    'LEAVE_STARTED' => l.hrmsErrLeaveStarted,
    'FEATURE_DISABLED' => l.hrmsErrFeatureOff,
    'HALF_DAY_RANGE' => l.hrmsEndBeforeStart,
    'RANGE_REVERSED' => l.hrmsEndBeforeStart,
    _ => describeError(e),
  };
}

String? _codeOf(Object e) {
  try {
    return (e as dynamic).response?.data?['error']?['code'] as String?;
  } catch (_) {
    return null;
  }
}
