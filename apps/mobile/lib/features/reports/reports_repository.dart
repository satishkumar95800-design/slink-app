import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/paginated_response.dart';
import '../../shared/models/report.dart';
import '../../shared/services/api_client.dart';

class ReportsRepository {
  final Dio _dio;

  ReportsRepository(this._dio);

  /// GET /reports — server scopes parents to published reports for their
  /// linked children only (ReportsService.findAll).
  Future<PaginatedResponse<Report>> getReports({String? studentId, int page = 1}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/reports',
      queryParameters: {
        if (studentId != null) 'studentId': studentId,
        'page': page,
        'limit': 50,
      },
    );
    return PaginatedResponse.fromJson(response.data!, Report.fromJson);
  }

  Future<Report> getReport(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/reports/$id');
    return Report.fromJson(response.data!);
  }

  Future<void> markRead(String id) async {
    await _dio.post('/reports/$id/read');
  }

  /// Creates a draft report-card report — the caller then uploads the PDF via
  /// FilesRepository.upload(..., entityId: report.id) and calls [attachPdf].
  Future<Report> createReportCard({
    required String studentId,
    required String term,
    required String academicYear,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>('/reports', data: {
      'studentId': studentId,
      'type': 'report_card',
      'term': term,
      'academicYear': academicYear,
      'content': <String, dynamic>{},
    });
    return Report.fromJson(response.data!);
  }

  Future<void> attachPdf(String reportId, String pdfKey) async {
    await _dio.patch('/reports/$reportId', data: {'pdfKey': pdfKey});
  }

  Future<void> publish(String reportId) async {
    await _dio.post('/reports/$reportId/publish');
  }
}

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(apiClientProvider));
});
