import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/receipt.dart';
import 'receipts_repository.dart';

/// A partially-paid fee can have more than one receipt (one per payment
/// instalment), so "View Receipt" from the Fees list lands here first rather
/// than jumping straight to a single receipt.
class FeeReceiptsPage extends ConsumerStatefulWidget {
  final String feeId;

  const FeeReceiptsPage({super.key, required this.feeId});

  @override
  ConsumerState<FeeReceiptsPage> createState() => _FeeReceiptsPageState();
}

class _FeeReceiptsPageState extends ConsumerState<FeeReceiptsPage> {
  late final Future<List<Receipt>> _receiptsFuture;

  @override
  void initState() {
    super.initState();
    _receiptsFuture = ref.read(receiptsRepositoryProvider).getReceiptsForFee(widget.feeId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Receipts')),
      body: FutureBuilder<List<Receipt>>(
        future: _receiptsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load receipts.'));
          }
          final receipts = snapshot.data ?? [];
          if (receipts.isEmpty) {
            return const Center(child: Text('No receipts yet for this fee.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: receipts.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final receipt = receipts[index];
              return Card(
                child: ListTile(
                  title: Text('₹${receipt.amount.toStringAsFixed(2)} · ${receipt.receiptNumber}'),
                  subtitle: Text(receipt.paidOn.toLocal().toString().split(' ').first),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/receipts/${receipt.id}'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
