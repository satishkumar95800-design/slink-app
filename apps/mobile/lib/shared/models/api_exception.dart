import 'package:dio/dio.dart';

/// Normalizes the API's error envelope: { success: false, statusCode, error: { message, error } }
class ApiException implements Exception {
  final int? statusCode;
  final String message;

  const ApiException(this.statusCode, this.message);

  factory ApiException.fromDioError(DioException error) {
    final status = error.response?.statusCode;
    final body = error.response?.data;

    if (body is Map<String, dynamic>) {
      final err = body['error'];
      if (err is Map<String, dynamic>) {
        final rawMessage = err['message'];
        if (rawMessage is List) {
          return ApiException(status, rawMessage.join(', '));
        }
        if (rawMessage is String) {
          return ApiException(status, rawMessage);
        }
      }
      final topLevelMessage = body['message'];
      if (topLevelMessage is String) {
        return ApiException(status, topLevelMessage);
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(null, 'Network timeout — check your connection and try again.');
      case DioExceptionType.connectionError:
        return const ApiException(null, 'No internet connection.');
      default:
        return ApiException(status, 'Something went wrong. Please try again.');
    }
  }

  @override
  String toString() => message;
}
