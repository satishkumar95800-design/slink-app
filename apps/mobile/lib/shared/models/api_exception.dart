import 'package:dio/dio.dart';
import '../../core/l10n/l10n.dart';

/// Normalizes the API's error envelope: { success: false, statusCode, error: { code?, message } }.
///
/// [message] is translated when the API sent a code the app knows (or for the
/// app's own network errors); otherwise it is the server's English text.
class ApiException implements Exception {
  final int? statusCode;

  /// API error code (e.g. PHONE_NOT_REGISTERED), or one of the app's own
  /// NETWORK_TIMEOUT / NO_INTERNET / UNKNOWN.
  final String? code;
  final String? _serverMessage;

  const ApiException(this.statusCode, String? serverMessage, {this.code}) : _serverMessage = serverMessage;

  /// Read at display time, so it follows the current language.
  String get message => translateErrorCode(code) ?? _serverMessage ?? currentL10n.errorGeneric;

  factory ApiException.fromDioError(DioException error) {
    final status = error.response?.statusCode;
    final body = error.response?.data;

    if (body is Map<String, dynamic>) {
      final err = body['error'];
      if (err is Map<String, dynamic>) {
        final code = err['code'] is String ? err['code'] as String : null;
        final rawMessage = err['message'];
        if (rawMessage is List) {
          return ApiException(status, rawMessage.join(', '), code: code);
        }
        if (rawMessage is String) {
          return ApiException(status, rawMessage, code: code);
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
        return const ApiException(null, null, code: 'NETWORK_TIMEOUT');
      case DioExceptionType.connectionError:
        return const ApiException(null, null, code: 'NO_INTERNET');
      default:
        return ApiException(status, null, code: 'UNKNOWN');
    }
  }

  @override
  String toString() => message;
}

/// Translated text for error codes the app knows; null for anything else, so
/// callers fall back to the server's English message.
String? translateErrorCode(String? code) {
  final l = currentL10n;
  return switch (code) {
    'NETWORK_TIMEOUT' => l.errorNetworkTimeout,
    'NO_INTERNET' => l.errorNoInternet,
    'UNKNOWN' => l.errorGeneric,
    'PHONE_NOT_REGISTERED' => l.errorPhoneNotRegistered,
    'SCHOOL_NOT_FOUND' => l.errorSchoolNotFound,
    _ => null,
  };
}

/// One line for an error caught anywhere: API errors as above, anything else generic.
String describeError(Object e) => switch (e) {
      ApiException() => e.message,
      DioException() => ApiException.fromDioError(e).message,
      _ => currentL10n.errorTryAgain,
    };
