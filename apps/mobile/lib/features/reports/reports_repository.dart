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
}

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(apiClientProvider));
});
