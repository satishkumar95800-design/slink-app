import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Centralizes the secure-storage keys used across the app so the auth
/// interceptor, session bootstrap, and login/logout flows all agree on them.
class SecureStorageService {
  static const _storage = FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _tenantIdKey = 'tenant_id';
  static const _userJsonKey = 'active_user';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readTenantId() => _storage.read(key: _tenantIdKey);
  Future<String?> readUserJson() => _storage.read(key: _userJsonKey);

  Future<void> writeAccessToken(String value) => _storage.write(key: _accessTokenKey, value: value);
  Future<void> writeRefreshToken(String value) => _storage.write(key: _refreshTokenKey, value: value);
  Future<void> writeTenantId(String value) => _storage.write(key: _tenantIdKey, value: value);
  Future<void> writeUserJson(String value) => _storage.write(key: _userJsonKey, value: value);

  Future<void> clearAll() => _storage.deleteAll();
}

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});
