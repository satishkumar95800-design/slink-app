import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Centralizes the secure-storage keys used across the app so the auth
/// interceptor, session bootstrap, and login/logout flows all agree on them.
class SecureStorageService {
  // resetOnError: if Android restores this storage from a backup, its keystore
  // key is gone and reads throw BAD_DECRYPT. Wipe it instead (= signed out).
  static const _storage = FlutterSecureStorage(aOptions: AndroidOptions(resetOnError: true));

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _tenantIdKey = 'tenant_id';
  static const _userJsonKey = 'active_user';
  static const _actAsKey = 'act_as';

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readTenantId() => _storage.read(key: _tenantIdKey);
  Future<String?> readUserJson() => _storage.read(key: _userJsonKey);

  /// 'parent' while a staff member uses parent mode, else null.
  Future<String?> readActAs() => _storage.read(key: _actAsKey);
  Future<void> writeActAs(String? value) =>
      value == null ? _storage.delete(key: _actAsKey) : _storage.write(key: _actAsKey, value: value);

  Future<void> writeAccessToken(String value) => _storage.write(key: _accessTokenKey, value: value);
  Future<void> writeRefreshToken(String value) => _storage.write(key: _refreshTokenKey, value: value);
  Future<void> writeTenantId(String value) => _storage.write(key: _tenantIdKey, value: value);
  Future<void> writeUserJson(String value) => _storage.write(key: _userJsonKey, value: value);

  Future<void> clearAll() => _storage.deleteAll();
}

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});
