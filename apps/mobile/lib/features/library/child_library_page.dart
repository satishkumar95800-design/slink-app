import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/services/api_client.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';

class ChildLoan {
  final String id;
  final String title;
  final String? author;
  final DateTime issuedOn;
  final DateTime dueOn;
  final DateTime? returnedOn;
  final int daysLate;
  final num? fineAmount;

  const ChildLoan({
    required this.id,
    required this.title,
    this.author,
    required this.issuedOn,
    required this.dueOn,
    this.returnedOn,
    required this.daysLate,
    this.fineAmount,
  });

  factory ChildLoan.fromJson(Map<String, dynamic> j) => ChildLoan(
        id: j['id'] as String,
        title: j['title'] as String,
        author: j['author'] as String?,
        issuedOn: DateTime.parse(j['issuedOn'] as String),
        dueOn: DateTime.parse(j['dueOn'] as String),
        returnedOn: j['returnedOn'] == null ? null : DateTime.parse(j['returnedOn'] as String),
        daysLate: j['daysLate'] as int,
        fineAmount: j['fineAmount'] == null ? null : num.parse(j['fineAmount'] as String),
      );
}

/// GET /library/child/:studentId: books out now and the last few returned.
final childLibraryProvider = FutureProvider.autoDispose.family<({List<ChildLoan> open, List<ChildLoan> recent}), String>((ref, studentId) async {
  final Dio dio = ref.watch(apiClientProvider);
  final r = await dio.get<Map<String, dynamic>>('/library/child/$studentId');
  List<ChildLoan> list(String k) => [for (final x in r.data![k] as List) ChildLoan.fromJson(x as Map<String, dynamic>)];
  return (open: list('open'), recent: list('recent'));
});

/// The parent's child's library books.
class ChildLibraryPage extends ConsumerWidget {
  final String studentId;

  const ChildLibraryPage({super.key, required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(childLibraryProvider(studentId));
    final date = DateFormat('dd/MM/yyyy');
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.libraryTitle)),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(childLibraryProvider(studentId).future),
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [LoadingBlock(height: 90), SizedBox(height: 10), LoadingBlock(height: 90)],
          ),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(childLibraryProvider(studentId)),
          ),
          data: (d) {
            if (d.open.isEmpty && d.recent.isEmpty) {
              return EmptyState(icon: Icons.menu_book_rounded, message: l.libraryNothingBorrowed, color: FeatureColors.reports);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(l.libraryWithChild, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                if (d.open.isEmpty)
                  SoftCard(child: Text(l.libraryNoneOut, style: const TextStyle(color: AppColors.muted)))
                else
                  for (final b in d.open) ...[
                    SoftCard(
                      child: Row(
                        children: [
                          IconBadge(icon: Icons.menu_book_rounded, color: b.daysLate > 0 ? AppColors.coral : FeatureColors.reports),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(b.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                                if (b.author != null) Text(b.author!, style: const TextStyle(color: AppColors.muted)),
                                const SizedBox(height: 6),
                                b.daysLate > 0
                                    ? StatusPill(label: l.libraryOverdueBy(b.daysLate), color: AppColors.coral, icon: Icons.schedule_rounded)
                                    : StatusPill(label: l.libraryReturnBy(date.format(b.dueOn)), color: FeatureColors.attendance),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                if (d.recent.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(l.libraryRecentlyReturned, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  for (final b in d.recent)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SoftCard(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Expanded(child: Text(b.title, style: const TextStyle(fontWeight: FontWeight.w700))),
                            if (b.fineAmount != null)
                              StatusPill(label: l.libraryFineDue(formatRupees(b.fineAmount)), color: AppColors.coral)
                            else if (b.returnedOn != null)
                              Text(date.format(b.returnedOn!), style: const TextStyle(color: AppColors.muted)),
                          ],
                        ),
                      ),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
