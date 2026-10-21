enum UserRole { parent, teacher, admin, accounts, superAdmin }

UserRole _parseRole(String raw) {
  switch (raw) {
    case 'parent':
      return UserRole.parent;
    case 'teacher':
      return UserRole.teacher;
    case 'admin':
      return UserRole.admin;
    case 'accounts':
      return UserRole.accounts;
    case 'super_admin':
      return UserRole.superAdmin;
    default:
      throw ArgumentError('Unknown role: $raw');
  }
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
        'role': role.name,
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
