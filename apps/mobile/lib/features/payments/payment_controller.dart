import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/models/payment_order.dart';
import 'payments_repository.dart';

enum PaymentStatus { idle, creatingOrder, awaitingCheckout, confirming, success, failed, timedOut }

class PaymentState {
  final PaymentStatus status;
  final String? errorMessage;

  const PaymentState({this.status = PaymentStatus.idle, this.errorMessage});
}

/// Drives one payment attempt end to end:
///   create order -> open Razorpay Checkout -> poll for webhook-driven capture.
///
/// Razorpay's client-side success callback fires the instant the user completes
/// checkout, but the actual capture (StudentFee.amountPaid update) happens
/// asynchronously via the server-to-server webhook — there is no client-facing
/// "confirm payment" endpoint (see payments module — capture is webhook-only).
/// So after checkout succeeds we poll GET /payments/orders/:id until the status
/// flips to paid, rather than trusting the client-side callback alone.
class PaymentController extends StateNotifier<PaymentState> {
  final Ref _ref;
  Razorpay? _razorpay;

  PaymentController(this._ref) : super(const PaymentState());

  Future<void> payFor(String studentFeeId, {String? parentPhone}) async {
    state = const PaymentState(status: PaymentStatus.creatingOrder);

    try {
      final order = await _ref.read(paymentsRepositoryProvider).createOrder(studentFeeId);
      if (order.keyId == null) {
        state = const PaymentState(
          status: PaymentStatus.failed,
          errorMessage: 'Payment is not set up for this school yet. Please contact the school office.',
        );
        return;
      }
      _openCheckout(order, parentPhone);
    } catch (e) {
      state = PaymentState(
        status: PaymentStatus.failed,
        errorMessage: e is ApiException ? e.message : 'Could not start payment. Please try again.',
      );
    }
  }

  void _openCheckout(PaymentOrder order, String? parentPhone) {
    final razorpay = Razorpay();
    _razorpay = razorpay;
    state = const PaymentState(status: PaymentStatus.awaitingCheckout);

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse response) {
      _confirmPayment(order.id);
    });
    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse response) {
      _disposeRazorpay();
      state = PaymentState(
        status: PaymentStatus.failed,
        errorMessage: response.message ?? 'Payment was not completed.',
      );
    });
    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse response) {});

    razorpay.open({
      'key': order.keyId,
      'amount': order.amountInPaise,
      'currency': order.currency,
      'order_id': order.gatewayOrderId,
      'name': 'School Connect',
      'description': 'Fee payment — ${order.studentFee.studentName}',
      if (parentPhone != null) 'prefill': {'contact': parentPhone},
    });
  }

  Future<void> _confirmPayment(String orderId) async {
    _disposeRazorpay();
    state = const PaymentState(status: PaymentStatus.confirming);

    const maxAttempts = 10;
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      await Future.delayed(const Duration(seconds: 2));
      try {
        final order = await _ref.read(paymentsRepositoryProvider).getOrder(orderId);
        if (order.status == PaymentOrderStatus.paid) {
          state = const PaymentState(status: PaymentStatus.success);
          return;
        }
        if (order.status == PaymentOrderStatus.failed) {
          state = const PaymentState(
            status: PaymentStatus.failed,
            errorMessage: 'The payment could not be confirmed. Please try again.',
          );
          return;
        }
      } catch (_) {
        // Transient network error while polling — keep trying until maxAttempts.
      }
    }
    state = const PaymentState(status: PaymentStatus.timedOut);
  }

  void _disposeRazorpay() {
    _razorpay?.clear();
    _razorpay = null;
  }

  void reset() {
    _disposeRazorpay();
    state = const PaymentState();
  }

  @override
  void dispose() {
    _disposeRazorpay();
    super.dispose();
  }
}

final paymentControllerProvider =
    StateNotifierProvider.autoDispose<PaymentController, PaymentState>((ref) {
  return PaymentController(ref);
});
