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

  const ActiveUser({
    required this.id,
    required this.name,
    required this.role,
    required this.tenantId,
  });

  factory ActiveUser.fromJson(Map<String, dynamic> json) => ActiveUser(
        id: json['id'] as String,
        name: json['name'] as String,
        role: _parseRole(json['role'] as String),
        tenantId: json['tenantId'] as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'role': role.name,
        'tenantId': tenantId,
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
