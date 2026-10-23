enum UserRole { parent, teacher, admin, accounts, superAdmin, driver, librarian, receptionist }

/// The API's name for each role (also what the session stores).
const _wire = {
  UserRole.parent: 'parent',
  UserRole.teacher: 'teacher',
  UserRole.admin: 'admin',
  UserRole.accounts: 'accounts',
  UserRole.superAdmin: 'super_admin',
  UserRole.driver: 'driver',
  UserRole.librarian: 'librarian',
  UserRole.receptionist: 'receptionist',
};

UserRole _parseRole(String raw) {
  for (final e in _wire.entries) {
    if (e.value == raw || e.key.name == raw) return e.key;
  }
  throw ArgumentError('Unknown role: $raw');
}

class ActiveUser {
  final String id;
  final String name;
  final UserRole role;
  final String tenantId;

  /// The language the user saved on their account, or null if they never chose.
  final String? preferredLanguage;

  /// What to show after sign-in: [preferredLanguage], else the school default.
  final String? language;

  /// Staff only: students of the school are linked to this account as its
  /// children, so the app offers the Staff | Parent switch.
  final bool hasChildren;

  const ActiveUser({
    required this.id,
    required this.name,
    required this.role,
    required this.tenantId,
    this.preferredLanguage,
    this.language,
    this.hasChildren = false,
  });

  ActiveUser copyWith({UserRole? role, bool? hasChildren}) => ActiveUser(
        id: id,
        name: name,
        role: role ?? this.role,
        tenantId: tenantId,
        preferredLanguage: preferredLanguage,
        language: language,
        hasChildren: hasChildren ?? this.hasChildren,
      );

  factory ActiveUser.fromJson(Map<String, dynamic> json) => ActiveUser(
        id: json['id'] as String,
        name: json['name'] as String,
        role: _parseRole(json['role'] as String),
        tenantId: json['tenantId'] as String,
        preferredLanguage: json['preferredLanguage'] as String?,
        language: json['language'] as String?,
        hasChildren: json['hasChildren'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'role': _wire[role],
        'tenantId': tenantId,
        'preferredLanguage': preferredLanguage,
        'language': language,
        'hasChildren': hasChildren,
      };
}

class AuthResult {
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final ActiveUser user;

  const AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.user,
  });

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        expiresIn: json['expiresIn'] as int,
        user: ActiveUser.fromJson(json['user'] as Map<String, dynamic>),
      );
}
