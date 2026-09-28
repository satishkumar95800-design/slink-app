import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/payment_claim.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import 'payment_claims_repository.dart';

final myPaymentClaimsProvider = FutureProvider.autoDispose<List<PaymentClaim>>((ref) {
  return ref.watch(paymentClaimsRepositoryProvider).getMyClaims();
});

class MyPaymentClaimsPage extends ConsumerWidget {
  const MyPaymentClaimsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final claimsAsync = ref.watch(myPaymentClaimsProvider);

    return AuthenticatedScaffold(
      appBar: AppBar(title: const Text('My Payment Claims')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myPaymentClaimsProvider),
        child: claimsAsync.when(
          data: (claims) {
            if (claims.isEmpty) {
              return const Center(child: Text('No payment claims submitted yet.'));
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: claims.length,
              itemBuilder: (context, index) => _ClaimCard(claim: claims[index]),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load your payment claims. Pull down to retry.\n$error', textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    );
  }
}

class _ClaimCard extends StatelessWidget {
  final PaymentClaim claim;

  const _ClaimCard({required this.claim});

  Color _statusColor() {
    switch (claim.status) {
      case PaymentClaimStatus.approved:
        return Colors.green;
      case PaymentClaimStatus.rejected:
        return Colors.red;
      case PaymentClaimStatus.pending:
        return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
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
                    claim.student.name,
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
                    claim.status.name.toUpperCase(),
                    style: TextStyle(color: _statusColor(), fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('Submitted ${claim.createdAt.toLocal().toString().split(' ').first}'),
            if (claim.claimedAmount != null) Text('Claimed amount: ₹${claim.claimedAmount!.toStringAsFixed(2)}'),
            if (claim.claimedMode != null) Text('Mode: ${claim.claimedMode}'),
            if (claim.note != null && claim.note!.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(claim.note!),
            ],
            if (claim.status == PaymentClaimStatus.rejected && claim.reviewNote != null && claim.reviewNote!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'School note: ${claim.reviewNote}',
                style: TextStyle(color: Colors.red.shade700, fontStyle: FontStyle.italic),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
