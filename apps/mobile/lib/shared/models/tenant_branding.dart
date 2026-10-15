class TenantBranding {
  final String id;
  final String name;
  final String? logoUrl;
  final String? backgroundImageUrl;

  /// Optional per-school modules from tenants.features (a missing key means off).
  final Map<String, bool> features;

  const TenantBranding({
    required this.id,
    required this.name,
    this.logoUrl,
    this.backgroundImageUrl,
    this.features = const {},
  });

  /// The school calendar is an optional module the platform team switches on.
  bool get calendarEnabled => features['calendar'] == true;

  factory TenantBranding.fromJson(Map<String, dynamic> json) => TenantBranding(
        id: json['id'] as String,
        name: json['name'] as String,
        logoUrl: json['logoUrl'] as String?,
        backgroundImageUrl: json['backgroundImageUrl'] as String?,
        features: _parseFeatures(json['features']),
      );

  static Map<String, bool> _parseFeatures(Object? raw) {
    if (raw is! Map) return const {};
    return {
      for (final e in raw.entries)
        if (e.key is String && e.value is bool) e.key as String: e.value as bool,
    };
  }
}
