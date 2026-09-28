import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/receipt.dart';
import '../../shared/services/api_client.dart';

class ReceiptsRepository {
  final Dio _dio;

  ReceiptsRepository(this._dio);

  /// GET /receipts?studentFeeId= — a partially-paid fee can have more than one receipt.
  Future<List<Receipt>> getReceiptsForFee(String studentFeeId) async {
    final response = await _dio.get<List<dynamic>>(
      '/receipts',
      queryParameters: {'studentFeeId': studentFeeId},
    );
    return (response.data ?? []).map((e) => Receipt.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Receipt> getReceipt(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/receipts/$id');
    return Receipt.fromJson(response.data!);
  }

  /// Signed, time-limited link to the receipt view — same link sent by SMS/push (Addendum 4 / A9).
  Future<String> getDownloadLink(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/receipts/$id/download-link');
    return response.data!['url'] as String;
  }
}

final receiptsRepositoryProvider = Provider<ReceiptsRepository>((ref) {
  return ReceiptsRepository(ref.watch(apiClientProvider));
});
