import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class FilesRepository {
  final Dio _dio;

  FilesRepository(this._dio);

  /// POST /files/upload (multipart) — returns the S3 key to reference elsewhere
  /// (e.g. as `fileKey` on POST /notifications/broadcast).
  Future<String> upload(File file, {required String category}) async {
    final formData = FormData.fromMap({
      'category': category,
      'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
    });
    final response = await _dio.post<Map<String, dynamic>>('/files/upload', data: formData);
    return response.data!['key'] as String;
  }
}

final filesRepositoryProvider = Provider<FilesRepository>((ref) {
  return FilesRepository(ref.watch(apiClientProvider));
});
