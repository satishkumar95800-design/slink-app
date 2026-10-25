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
  static const _appLockKey = 'app_lock';
  static const _appLockOfferedKey = 'app_lock_offered';

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

  /// Biometric unlock for this signed-in session ('1' when on). Signing out
  /// clears it with everything else, so the next person starts with OTP.
  Future<bool> readAppLock() async => await _storage.read(key: _appLockKey) == '1';
  Future<void> writeAppLock(bool on) => on ? _storage.write(key: _appLockKey, value: '1') : _storage.delete(key: _appLockKey);

  /// Whether this session was already offered biometric unlock.
  Future<bool> readAppLockOffered() async => await _storage.read(key: _appLockOfferedKey) == '1';
  Future<void> writeAppLockOffered() => _storage.write(key: _appLockOfferedKey, value: '1');

  Future<void> clearAll() => _storage.deleteAll();
}

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});
