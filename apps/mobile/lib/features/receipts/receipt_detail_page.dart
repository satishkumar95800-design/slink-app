import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../shared/models/receipt.dart';
import 'receipts_repository.dart';

const _methodLabels = {
  'cash': 'Cash',
  'cheque': 'Cheque',
  'bank_transfer': 'Bank Transfer',
  'demand_draft': 'Demand Draft',
  'gateway': 'Online Payment',
};

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
      final url = await ref.read(receiptsRepositoryProvider).getDownloadLink(widget.receiptId);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open the receipt. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Receipt')),
      body: FutureBuilder<Receipt>(
        future: _receiptFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return const Center(child: Text('Could not load this receipt.'));
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
                Text('Amount Received', style: Theme.of(context).textTheme.bodySmall),
                Text(
                  '₹${receipt.amount.toStringAsFixed(2)}',
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
                              ? 'Discount applied: ${receipt.discountTypeName}'
                              : 'Discount applied',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        Text('−₹${receipt.discountAmount!.toStringAsFixed(2)}'),
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
                Text('Method: ${_methodLabels[receipt.method] ?? receipt.method}'),
                Text('Paid on: ${receipt.paidOn.toLocal().toString().split(' ').first}'),
                if (receipt.reference != null) Text('Reference: ${receipt.reference}'),
                if (receipt.notes != null) ...[
                  const SizedBox(height: 16),
                  Text('Notes', style: Theme.of(context).textTheme.bodySmall),
                  Text(receipt.notes!),
                ],
                const SizedBox(height: 32),
                FilledButton.icon(
                  onPressed: _downloading ? null : _download,
                  icon: const Icon(Icons.download),
                  label: Text(_downloading ? 'Opening…' : 'Download'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
