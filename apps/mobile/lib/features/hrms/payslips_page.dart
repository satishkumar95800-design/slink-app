import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'hrms_models.dart';
import 'hrms_repository.dart';
import 'hrms_widgets.dart';

/// Finalised payslips, newest month first. Tap one to view its PDF.
class PayslipsPage extends ConsumerWidget {
  const PayslipsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    final async = ref.watch(payslipsProvider);
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.hrmsPayslipsTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(payslipsProvider.future),
        child: async.when(
          loading: () => ListView(padding: const EdgeInsets.all(16), children: const [LoadingBlock(height: 90), SizedBox(height: 10), LoadingBlock(height: 90)]),
          error: (e, _) => HrmsError(error: e, onRetry: () => ref.invalidate(payslipsProvider)),
          data: (slips) {
            if (slips.isEmpty) {
              return EmptyState(icon: Icons.receipt_long_rounded, message: l.hrmsPayslipsEmpty, color: FeatureColors.fees);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final p in slips)
                  ListCard(
                    leading: const IconBadge(icon: Icons.receipt_long_rounded, color: FeatureColors.fees, size: 44),
                    title: monthLabel(p.month, lang),
                    subtitle: '${l.hrmsGross} ${formatRupees(p.gross)} · ${l.hrmsDeductions} ${formatRupees(p.deductions)}\n'
                        '${p.paidAt != null ? l.hrmsPaidOn(displayYmd(ymd(p.paidAt!))) : l.hrmsNotPaidYet}',
                    trailing: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(l.hrmsNetPay, style: Theme.of(context).textTheme.labelSmall),
                        Text(formatRupees(p.net), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      ],
                    ),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                      builder: (_) => PayslipViewerPage(payslip: p),
                    )),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Downloads the payslip PDF with the signed-in session and shows it in-app.
class PayslipViewerPage extends ConsumerStatefulWidget {
  final Payslip payslip;

  const PayslipViewerPage({super.key, required this.payslip});

  @override
  ConsumerState<PayslipViewerPage> createState() => _PayslipViewerPageState();
}

class _PayslipViewerPageState extends ConsumerState<PayslipViewerPage> {
  late Future<String> _file;

  @override
  void initState() {
    super.initState();
    _file = ref.read(hrmsRepositoryProvider).downloadPayslipPdf(widget.payslip.id);
  }

  /// Opens the system share sheet with the PDF, from which it can be saved to Files/Downloads or sent on.
  Future<void> _share(BuildContext btnContext, String path) async {
    final box = btnContext.findRenderObject() as RenderBox?;
    final messenger = ScaffoldMessenger.of(context);
    final failed = context.l10n.hrmsPayslipOpenFailed;
    try {
      await SharePlus.instance.share(ShareParams(
        files: [XFile(path, mimeType: 'application/pdf', name: 'payslip-${widget.payslip.month}.pdf')],
        fileNameOverrides: ['payslip-${widget.payslip.month}.pdf'],
        sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
      ));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(failed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final lang = Localizations.localeOf(context).languageCode;
    return AuthenticatedScaffold(
      appBar: AppBar(
        title: Text(l.hrmsPayslipViewerTitle(monthLabel(widget.payslip.month, lang))),
        actions: [
          FutureBuilder<String>(
            future: _file,
            builder: (context, snap) => snap.hasData
                ? Builder(
                    // The share sheet anchors to this button on iPad.
                    builder: (btnContext) => IconButton(
                      icon: const Icon(Icons.ios_share_rounded),
                      tooltip: l.hrmsPayslipSave,
                      onPressed: () => _share(btnContext, snap.data!),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
      body: FutureBuilder<String>(
        future: _file,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError || snap.data == null) {
            return EmptyState(
              icon: Icons.error_outline_rounded,
              message: l.hrmsPayslipOpenFailed,
              color: AppColors.coral,
              actionLabel: l.commonRetry,
              onAction: () => setState(() {
                _file = ref.read(hrmsRepositoryProvider).downloadPayslipPdf(widget.payslip.id);
              }),
            );
          }
          return PDFView(filePath: snap.data!);
        },
      ),
    );
  }
}
