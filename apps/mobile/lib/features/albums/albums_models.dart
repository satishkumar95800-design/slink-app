/// A photo with short-lived links (about an hour) to the photo and its thumbnail.
class AlbumPhoto {
  final String id;
  final String url;
  final String thumbUrl;

  const AlbumPhoto({required this.id, required this.url, required this.thumbUrl});

  factory AlbumPhoto.fromJson(Map<String, dynamic> j) =>
      AlbumPhoto(id: j['id'] as String, url: j['url'] as String, thumbUrl: j['thumbUrl'] as String);
}

DateTime? _date(Object? v) => v is String ? DateTime.parse(v).toLocal() : null;

/// GET /albums/child/:studentId — one album sent to the parent's child.
class ChildAlbum {
  final String id;
  final String title;
  final String? description;
  final DateTime? expiresAt;
  final bool expired;
  final int photoCount;
  final bool saved;
  final String? coverUrl;

  const ChildAlbum({
    required this.id,
    required this.title,
    this.description,
    this.expiresAt,
    required this.expired,
    required this.photoCount,
    required this.saved,
    this.coverUrl,
  });

  factory ChildAlbum.fromJson(Map<String, dynamic> j) => ChildAlbum(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        expiresAt: _date(j['expiresAt']),
        expired: j['expired'] == true,
        photoCount: j['photoCount'] as int,
        saved: j['saved'] == true,
        coverUrl: j['coverUrl'] as String?,
      );
}

/// GET /albums/child/:studentId/:id — the photos of one album.
class AlbumPhotos {
  final String id;
  final String title;
  final String? description;
  final DateTime? expiresAt;
  final List<AlbumPhoto> photos;

  const AlbumPhotos({required this.id, required this.title, this.description, this.expiresAt, required this.photos});

  factory AlbumPhotos.fromJson(Map<String, dynamic> j) => AlbumPhotos(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        expiresAt: _date(j['expiresAt']),
        photos: [for (final p in j['photos'] as List) AlbumPhoto.fromJson(p as Map<String, dynamic>)],
      );
}

/// A teacher's album (GET /albums and /albums/:id).
class StaffAlbum {
  final String id;
  final String title;
  final String status;
  final DateTime? expiresAt;
  final int photoCount;
  final int savedCount;
  final int parentCount;
  final int maxPhotos;
  final List<AlbumPhoto> photos;

  const StaffAlbum({
    required this.id,
    required this.title,
    required this.status,
    this.expiresAt,
    required this.photoCount,
    required this.savedCount,
    this.parentCount = 0,
    this.maxPhotos = 100,
    this.photos = const [],
  });

  bool get isDraft => status == 'draft';
  bool get isLive => status == 'live';

  factory StaffAlbum.fromJson(Map<String, dynamic> j) {
    final photos = [for (final p in (j['photos'] as List?) ?? const []) AlbumPhoto.fromJson(p as Map<String, dynamic>)];
    return StaffAlbum(
      id: j['id'] as String,
      title: j['title'] as String,
      status: j['status'] as String,
      expiresAt: _date(j['expiresAt']),
      photoCount: (j['photoCount'] as int?) ?? photos.length,
      savedCount: (j['savedCount'] as int?) ?? 0,
      parentCount: (j['parentCount'] as int?) ?? 0,
      maxPhotos: ((j['limits'] as Map<String, dynamic>?)?['photosPerAlbum'] as int?) ?? 100,
      photos: photos,
    );
  }
}
