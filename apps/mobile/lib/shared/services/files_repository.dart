import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

const _uploadTimeout = Duration(seconds: 90);

class FilesRepository {
  final Dio _dio;

  FilesRepository(this._dio);

  /// POST /files/upload (multipart) — returns the S3 key to reference elsewhere
  /// (e.g. as `fileKey` on POST /notifications/broadcast, or `pdfKey` on a report).
  /// [entityId] scopes the key path to the entity this file belongs to (e.g. a
  /// report's id for category `report_pdf`) — required by categories that key
  /// their S3 path off it, ignored by ones that don't.
  Future<String> upload(File file, {required String category, String? entityId}) async {
    final formData = FormData.fromMap({
      'category': category,
      if (entityId != null) 'entityId': entityId,
      'file': await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
    });
    // The API streams the file on to S3 before replying, so a photo on a slow
    // mobile connection easily exceeds the client-wide 10s default.
    final response = await _dio.post<Map<String, dynamic>>(
      '/files/upload',
      data: formData,
      options: Options(sendTimeout: _uploadTimeout, receiveTimeout: _uploadTimeout),
    );
    return response.data!['key'] as String;
  }
}

final filesRepositoryProvider = Provider<FilesRepository>((ref) {
  return FilesRepository(ref.watch(apiClientProvider));
});
