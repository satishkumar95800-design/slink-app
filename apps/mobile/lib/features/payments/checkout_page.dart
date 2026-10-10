import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/models/student_fee.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import '../fees/fees_providers.dart';
import '../fees/fees_repository.dart';
import 'payment_controller.dart';
import '../../core/format/money.dart';
import '../../core/l10n/l10n.dart';

class CheckoutPage extends ConsumerStatefulWidget {
  final String feeId;

  const CheckoutPage({super.key, required this.feeId});

  @override
  ConsumerState<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends ConsumerState<CheckoutPage> {
  // Fetched once — must NOT be re-created on every rebuild, since payment
  // status changes (creatingOrder -> awaitingCheckout -> confirming -> ...)
  // rebuild this widget repeatedly while checkout is in progress.
  late final Future<StudentFee> _feeFuture;

  @override
  void initState() {
    super.initState();
    _feeFuture = ref.read(feesRepositoryProvider).getStudentFee(widget.feeId);
  }

  @override
  Widget build(BuildContext context) {
    final paymentState = ref.watch(paymentControllerProvider);

    ref.listen(paymentControllerProvider, (previous, next) {
      if (next.status == PaymentStatus.success && previous?.status != PaymentStatus.success) {
        ref.invalidate(studentFeesProvider);
      }
    });

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.checkoutTitle)),
      body: SafeArea(
        child: FutureBuilder<StudentFee>(
          future: _feeFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError || !snapshot.hasData) {
              return Center(child: Text(context.l10n.checkoutCouldNotLoad));
            }
            return _CheckoutBody(fee: snapshot.data!, paymentState: paymentState);
          },
        ),
      ),
    );
  }
}

class _CheckoutBody extends ConsumerWidget {
  final StudentFee fee;
  final PaymentState paymentState;

  const _CheckoutBody({required this.fee, required this.paymentState});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (paymentState.status == PaymentStatus.success) {
      return _SuccessView(onDone: () => context.go('/dashboard/fees'));
    }
    final l = context.l10n;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(fee.feeStructure.name, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text([fee.student.name, if (fee.student.className != null) fee.student.className!].join(' • ')),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final item in fee.feeStructure.items)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(child: Text(item.label)),
                          Text(formatRupees(item.amount)),
                        ],
                      ),
                    ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(child: Text(l.checkoutAmountDue, style: const TextStyle(fontWeight: FontWeight.bold))),
                      Text(
                        formatRupees(fee.outstanding),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          if (paymentState.status == PaymentStatus.failed && paymentState.errorMessage != null)
            ErrorBanner(message: paymentState.errorMessage!),
          if (paymentState.status == PaymentStatus.timedOut)
            ErrorBanner(message: l.checkoutConfirmingWithBank),
          if (paymentState.status == PaymentStatus.confirming)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: Column(
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 12),
                    Text(l.checkoutConfirming),
                  ],
                ),
              ),
            )
          else
            PrimaryButton(
              label: l.checkoutPayAmount(formatRupees(fee.outstanding)),
              isLoading: paymentState.status == PaymentStatus.creatingOrder ||
                  paymentState.status == PaymentStatus.awaitingCheckout,
              onPressed: () => ref.read(paymentControllerProvider.notifier).payFor(fee.id),
            ),
        ],
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  final VoidCallback onDone;

  const _SuccessView({required this.onDone});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 16),
            Text(context.l10n.checkoutSuccess, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 24),
            PrimaryButton(label: context.l10n.checkoutBackToFees, onPressed: onDone),
          ],
        ),
      ),
    );
  }
}
