import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'consent_models.dart';

/// Consent forms for the signed-in parent's children (/consent-forms).
class ConsentRepository {
  final Dio _dio;

  ConsentRepository(this._dio);

  Future<List<ConsentItem>> mine() async {
    final r = await _dio.get<List<dynamic>>('/consent-forms/mine');
    return [for (final e in r.data ?? []) ConsentItem.fromJson(e as Map<String, dynamic>)];
  }

  Future<ConsentAnswer> respond({
    required String formId,
    required String studentId,
    required bool approve,
    required String signedName,
    String? note,
  }) async {
    final r = await _dio.post<Map<String, dynamic>>('/consent-forms/$formId/respond', data: {
      'studentId': studentId,
      'decision': approve ? 'APPROVED' : 'DECLINED',
      'signedName': signedName,
      'confirm': true,
      if (note != null && note.isNotEmpty) 'note': note,
    });
    return ConsentAnswer.fromJson(r.data!);
  }
}

final consentRepositoryProvider = Provider<ConsentRepository>((ref) => ConsentRepository(ref.watch(apiClientProvider)));

final consentItemsProvider = FutureProvider.autoDispose<List<ConsentItem>>((ref) => ref.watch(consentRepositoryProvider).mine());

/// How many forms still need an answer; 0 while loading or on error, so the home badge never flashes.
final consentPendingCountProvider = Provider.autoDispose<int>((ref) {
  return ref.watch(consentItemsProvider).valueOrNull?.where((i) => i.needsAnswer).length ?? 0;
});
