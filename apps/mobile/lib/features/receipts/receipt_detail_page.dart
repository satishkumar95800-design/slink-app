import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/receipt.dart';
import 'receipts_repository.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';
import '../fees/fee_labels.dart';
import '../home/parent_home_models.dart';

class ReceiptDetailPage extends ConsumerStatefulWidget {
  final String receiptId;

  const ReceiptDetailPage({super.key, required this.receiptId});

  @override
  ConsumerState<ReceiptDetailPage> createState() => _ReceiptDetailPageState();
}

class _ReceiptDetailPageState extends ConsumerState<ReceiptDetailPage> {
  late final Future<Receipt> _receiptFuture;
  bool _downloading = false;

  @override
  void initState() {
    super.initState();
    _receiptFuture = ref.read(receiptsRepositoryProvider).getReceipt(widget.receiptId);
  }

  Future<void> _download() async {
    setState(() => _downloading = true);
    try {
      await openReceiptPdf(ref, context, widget.receiptId);
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l.receiptTitle)),
      body: FutureBuilder<Receipt>(
        future: _receiptFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(child: Text(l.receiptCouldNotLoad));
          }

          final receipt = snapshot.data!;
          return SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(receipt.receiptNumber, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(receipt.studentName),
                Text(receipt.feeStructureName, style: Theme.of(context).textTheme.bodySmall),
                const Divider(height: 32),
                Text(l.receiptAmountReceived, style: Theme.of(context).textTheme.bodySmall),
                Text(
                  formatRupees(receipt.amount),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                if (receipt.discountAmount != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          receipt.discountTypeName != null
                              ? l.receiptDiscountAppliedNamed(receipt.discountTypeName!)
                              : l.receiptDiscountApplied,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        Text('−${formatRupees(receipt.discountAmount)}'),
                        if (receipt.discountNote != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            receipt.discountNote!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Text(l.receiptMethod(paymentModeLabel(l, receipt.method))),
                Text(l.receiptPaidOn(displayDate(receipt.paidOn))),
                if (receipt.reference != null) Text(l.receiptReference(receipt.reference!)),
                if (receipt.notes != null) ...[
                  const SizedBox(height: 16),
                  Text(l.receiptNotes, style: Theme.of(context).textTheme.bodySmall),
                  Text(receipt.notes!),
                ],
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: _downloading ? null : _download,
                  icon: const Icon(Icons.download),
                  label: Text(_downloading ? l.receiptOpening : l.receiptDownload),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
