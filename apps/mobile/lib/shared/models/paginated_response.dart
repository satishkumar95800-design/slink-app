class PaginatedResponse<T> {
  final List<T> data;
  final int total;
  final int page;
  final int limit;

  const PaginatedResponse({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  bool get hasMore => page * limit < total;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    return PaginatedResponse(
      data: (json['data'] as List<dynamic>)
          .map((e) => fromJsonT(e as Map<String, dynamic>))
          .toList(),
      total: json['total'] as int,
      page: json['page'] as int,
      limit: json['limit'] as int,
    );
  }
}
