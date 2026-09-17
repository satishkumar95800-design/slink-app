class TenantBranding {
  final String id;
  final String name;
  final String? logoUrl;
  final String? backgroundImageUrl;

  const TenantBranding({
    required this.id,
    required this.name,
    this.logoUrl,
    this.backgroundImageUrl,
  });

  factory TenantBranding.fromJson(Map<String, dynamic> json) => TenantBranding(
        id: json['id'] as String,
        name: json['name'] as String,
        logoUrl: json['logoUrl'] as String?,
        backgroundImageUrl: json['backgroundImageUrl'] as String?,
      );
}
