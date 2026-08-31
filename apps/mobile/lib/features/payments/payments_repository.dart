import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/payment_order.dart';
import '../../shared/services/api_client.dart';

class PaymentsRepository {
  final Dio _dio;

  PaymentsRepository(this._dio);

  /// Idempotent server-side: re-calling for the same studentFeeId returns the
  /// existing order (with a fresh keyId) unless that order has already failed.
  Future<PaymentOrder> createOrder(String studentFeeId) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/payments/orders',
      data: {'studentFeeId': studentFeeId},
    );
    return PaymentOrder.fromJson(response.data!);
  }

  Future<PaymentOrder> getOrder(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/payments/orders/$id');
    return PaymentOrder.fromJson(response.data!);
  }
}

final paymentsRepositoryProvider = Provider<PaymentsRepository>((ref) {
  return PaymentsRepository(ref.watch(apiClientProvider));
});
