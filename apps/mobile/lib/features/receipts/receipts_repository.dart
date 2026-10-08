import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/receipt.dart';
import '../../shared/services/api_client.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/strings.dart';

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

  /// Signed, time-limited link to the receipt PDF. The API returns a path
  /// relative to its own base URL, which this client already knows.
  Future<Uri> getPdfLink(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/receipts/$id/download-link');
    final path = response.data!['pdfPath'] as String;
    return Uri.parse('${_dio.options.baseUrl.replaceAll(RegExp(r'/+$'), '')}$path');
  }
}

/// Opens a receipt PDF in the phone's browser/PDF viewer, which can save or share it.
Future<void> openReceiptPdf(WidgetRef ref, BuildContext context, String receiptId) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final uri = await ref.read(receiptsRepositoryProvider).getPdfLink(receiptId);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) throw Exception('No app could open the PDF');
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text(AppStrings.couldNotOpenReceipt)));
  }
}

final receiptsRepositoryProvider = Provider<ReceiptsRepository>((ref) {
  return ReceiptsRepository(ref.watch(apiClientProvider));
});
