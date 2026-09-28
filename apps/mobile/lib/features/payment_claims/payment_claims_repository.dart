import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/payment_claim.dart';
import '../../shared/services/api_client.dart';

class PaymentClaimsRepository {
  final Dio _dio;

  PaymentClaimsRepository(this._dio);

  /// POST /payment-claims — submits a parent's "I already paid this" claim
  /// for accountant/admin review. Does not mark the fee paid by itself.
  Future<void> submitClaim({
    required String studentFeeId,
    required String fileKey,
    double? claimedAmount,
    DateTime? claimedDate,
    String? claimedMode,
    String? note,
  }) async {
    await _dio.post<Map<String, dynamic>>('/payment-claims', data: {
      'studentFeeId': studentFeeId,
      'fileKey': fileKey,
      if (claimedAmount != null) 'claimedAmount': claimedAmount,
      if (claimedDate != null) 'claimedDate': claimedDate.toIso8601String().split('T').first,
      if (claimedMode != null) 'claimedMode': claimedMode,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  /// GET /payment-claims/mine — the calling parent's own submitted claims.
  Future<List<PaymentClaim>> getMyClaims() async {
    final response = await _dio.get<List<dynamic>>('/payment-claims/mine');
    return (response.data ?? [])
        .map((e) => PaymentClaim.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

final paymentClaimsRepositoryProvider = Provider<PaymentClaimsRepository>((ref) {
  return PaymentClaimsRepository(ref.watch(apiClientProvider));
});
