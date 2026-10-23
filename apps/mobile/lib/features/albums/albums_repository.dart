import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'albums_models.dart';

/// Photo albums (Premium Max): parents view and save, teachers make and share.
class AlbumsRepository {
  final Dio _dio;

  /// Signed S3 links must not carry the app's Authorization header.
  final Dio _plain = Dio();

  AlbumsRepository(this._dio);

  // ── Parent ──
  Future<List<ChildAlbum>> forChild(String studentId) async {
    final r = await _dio.get<List<dynamic>>('/albums/child/$studentId');
    return [for (final a in r.data!) ChildAlbum.fromJson(a as Map<String, dynamic>)];
  }

  Future<AlbumPhotos> photos(String studentId, String albumId) async {
    final r = await _dio.get<Map<String, dynamic>>('/albums/child/$studentId/$albumId');
    return AlbumPhotos.fromJson(r.data!);
  }

  Future<void> markSaved(String studentId, String albumId) =>
      _dio.post<void>('/albums/child/$studentId/$albumId/saved');

  /// The photo's bytes from its signed link.
  Future<Uint8List> download(String url) async {
    final r = await _plain.get<List<int>>(url, options: Options(responseType: ResponseType.bytes));
    return Uint8List.fromList(r.data!);
  }

  // ── Teacher ──
  Future<List<StaffAlbum>> mine() async {
    final r = await _dio.get<List<dynamic>>('/albums');
    return [for (final a in r.data!) StaffAlbum.fromJson(a as Map<String, dynamic>)];
  }

  Future<StaffAlbum> detail(String id) async {
    final r = await _dio.get<Map<String, dynamic>>('/albums/$id');
    return StaffAlbum.fromJson(r.data!);
  }

  Future<StaffAlbum> create(String title, List<String> classIds) async {
    final r = await _dio.post<Map<String, dynamic>>('/albums', data: {'title': title, 'classIds': classIds, 'studentIds': <String>[]});
    return StaffAlbum.fromJson(r.data!);
  }

  /// [photo] is a resized JPEG/PNG file; [thumb] a small PNG made on the phone.
  Future<void> addPhoto(String id, String photoPath, Uint8List thumb, {int? width, int? height}) async {
    final name = photoPath.split('/').last;
    await _dio.post<void>(
      '/albums/$id/photos',
      data: FormData.fromMap({
        'photo': await MultipartFile.fromFile(photoPath, filename: name),
        'thumb': MultipartFile.fromBytes(thumb, filename: 'thumb.png'),
        if (width != null) 'width': width,
        if (height != null) 'height': height,
      }),
    );
  }

  Future<void> removePhoto(String id, String photoId) => _dio.delete<void>('/albums/$id/photos/$photoId');

  Future<void> publish(String id) => _dio.post<void>('/albums/$id/publish');
}

final albumsRepositoryProvider = Provider<AlbumsRepository>((ref) => AlbumsRepository(ref.watch(apiClientProvider)));

final childAlbumsProvider = FutureProvider.autoDispose.family<List<ChildAlbum>, String>(
  (ref, studentId) => ref.watch(albumsRepositoryProvider).forChild(studentId),
);

final myAlbumsProvider = FutureProvider.autoDispose<List<StaffAlbum>>((ref) => ref.watch(albumsRepositoryProvider).mine());
