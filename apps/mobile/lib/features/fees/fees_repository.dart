import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/paginated_response.dart';
import '../../shared/models/student_fee.dart';
import '../../shared/services/api_client.dart';

class FeesRepository {
  final Dio _dio;

  FeesRepository(this._dio);

  /// GET /student-fees — server scopes results to the caller's linked children.
  Future<PaginatedResponse<StudentFee>> getStudentFees({String? studentId, int page = 1}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/student-fees',
      queryParameters: {
        if (studentId != null) 'studentId': studentId,
        'page': page,
        'limit': 50,
      },
    );
    return PaginatedResponse.fromJson(response.data!, StudentFee.fromJson);
  }

  Future<StudentFee> getStudentFee(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/student-fees/$id');
    return StudentFee.fromJson(response.data!);
  }
}

final feesRepositoryProvider = Provider<FeesRepository>((ref) {
  return FeesRepository(ref.watch(apiClientProvider));
});
