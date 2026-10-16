import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/api_client.dart';
import 'staff_docs_models.dart';

const _uploadTimeout = Duration(seconds: 120);

/// Extensions the API accepts for shared staff documents (20 MB each).
const staffDocExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const staffDocMaxBytes = 20 * 1024 * 1024;

/// Shared staff folders and files (/staff-documents). Every teacher of the
/// school sees all of them; the server decides who may rename or delete.
class StaffDocsRepository {
  final Dio _dio;

  StaffDocsRepository(this._dio);

  Future<List<StaffFolder>> folders() async {
    final r = await _dio.get<List<dynamic>>('/staff-documents/folders');
    return [for (final e in r.data ?? []) StaffFolder.fromJson(e as Map<String, dynamic>)];
  }

  Future<void> createFolder(String name) async {
    await _dio.post<Map<String, dynamic>>('/staff-documents/folders', data: {'name': name});
  }

  Future<void> renameFolder(String id, String name) async {
    await _dio.patch<Map<String, dynamic>>('/staff-documents/folders/$id', data: {'name': name});
  }

  Future<void> deleteFolder(String id) async {
    await _dio.delete<void>('/staff-documents/folders/$id');
  }

  Future<FolderContents> files(String folderId) async {
    final r = await _dio.get<Map<String, dynamic>>('/staff-documents/folders/$folderId/files');
    return FolderContents.fromJson(r.data!);
  }

  Future<void> upload(String folderId, File file, String fileName) async {
    final form = FormData.fromMap({'file': await MultipartFile.fromFile(file.path, filename: fileName)});
    await _dio.post<Map<String, dynamic>>(
      '/staff-documents/folders/$folderId/files',
      data: form,
      options: Options(sendTimeout: _uploadTimeout, receiveTimeout: _uploadTimeout),
    );
  }

  /// A short-lived link that downloads the file under its original name.
  Future<Uri> downloadLink(String folderId, String fileId) async {
    final r = await _dio.get<Map<String, dynamic>>('/staff-documents/folders/$folderId/files/$fileId/url');
    return Uri.parse(r.data!['url'] as String);
  }

  Future<void> deleteFile(String folderId, String fileId) async {
    await _dio.delete<void>('/staff-documents/folders/$folderId/files/$fileId');
  }
}

final staffDocsRepositoryProvider = Provider<StaffDocsRepository>((ref) => StaffDocsRepository(ref.watch(apiClientProvider)));

final staffFoldersProvider = FutureProvider.autoDispose<List<StaffFolder>>((ref) => ref.watch(staffDocsRepositoryProvider).folders());

final staffFolderFilesProvider =
    FutureProvider.autoDispose.family<FolderContents, String>((ref, id) => ref.watch(staffDocsRepositoryProvider).files(id));
