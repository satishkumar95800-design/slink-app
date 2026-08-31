import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'secure_storage_service.dart';

const _baseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000/v1');

final apiClientProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Content-Type': 'application/json'},
  ));

  dio.interceptors.add(_AuthInterceptor(ref, dio));
  return dio;
});

/// Attaches Authorization/X-Tenant-ID headers on every request, and on a 401
/// transparently refreshes the token pair once and retries the original request.
/// Concurrent 401s share a single in-flight refresh via [_refreshCompleter].
class _AuthInterceptor extends Interceptor {
  final Ref _ref;
  final Dio _dio;
  Completer<bool>? _refreshCompleter;

  _AuthInterceptor(this._ref, this._dio);

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final storage = _ref.read(secureStorageServiceProvider);
    final token = await storage.readAccessToken();
    final tenantId = await storage.readTenantId();

    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    if (tenantId != null) options.headers['X-Tenant-ID'] = tenantId;

    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final path = err.requestOptions.path;
    final isAuthEndpoint = path.contains('/auth/refresh') ||
        path.contains('/auth/phone/verify') ||
        path.contains('/auth/email/login');
    final alreadyRetried = err.requestOptions.extra['retried'] == true;

    if (err.response?.statusCode != 401 || isAuthEndpoint || alreadyRetried) {
      return handler.next(err);
    }

    final refreshed = await _refreshToken();
    if (!refreshed) {
      return handler.next(err);
    }

    try {
      final storage = _ref.read(secureStorageServiceProvider);
      final token = await storage.readAccessToken();
      final retryOptions = err.requestOptions;
      retryOptions.extra['retried'] = true;
      retryOptions.headers['Authorization'] = 'Bearer $token';
      final response = await _dio.fetch(retryOptions);
      handler.resolve(response);
    } catch (_) {
      handler.next(err);
    }
  }

  Future<bool> _refreshToken() async {
    if (_refreshCompleter != null) return _refreshCompleter!.future;

    final completer = Completer<bool>();
    _refreshCompleter = completer;

    try {
      final storage = _ref.read(secureStorageServiceProvider);
      final refreshToken = await storage.readRefreshToken();
      if (refreshToken == null) {
        completer.complete(false);
        return false;
      }

      final tenantId = await storage.readTenantId();
      // Bare client — avoids re-entering this same interceptor chain.
      final refreshDio = Dio(BaseOptions(baseUrl: _dio.options.baseUrl));
      final response = await refreshDio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
        options: Options(headers: tenantId != null ? {'X-Tenant-ID': tenantId} : null),
      );

      final data = response.data!;
      await storage.writeAccessToken(data['accessToken'] as String);
      await storage.writeRefreshToken(data['refreshToken'] as String);
      completer.complete(true);
      return true;
    } catch (_) {
      // Refresh token is invalid/expired — clear the session so the router's
      // redirect logic sends the user back to login on their next navigation.
      await _ref.read(secureStorageServiceProvider).clearAll();
      completer.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }
}
