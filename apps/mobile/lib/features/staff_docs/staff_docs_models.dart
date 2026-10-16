/// A shared staff folder (GET /staff-documents/folders).
class StaffFolder {
  final String id;
  final String name;
  final int fileCount;
  final String? createdBy;
  final bool canManage;

  const StaffFolder({
    required this.id,
    required this.name,
    required this.fileCount,
    required this.createdBy,
    required this.canManage,
  });

  factory StaffFolder.fromJson(Map<String, dynamic> j) => StaffFolder(
        id: j['id'] as String,
        name: j['name'] as String,
        fileCount: (j['fileCount'] as num?)?.toInt() ?? 0,
        createdBy: j['createdBy'] as String?,
        canManage: j['canManage'] == true,
      );
}

/// A file in a shared folder.
class StaffFile {
  final String id;
  final String fileName;
  final String contentType;
  final int size;
  final String? uploadedBy;
  final DateTime createdAt;
  final bool canManage;

  const StaffFile({
    required this.id,
    required this.fileName,
    required this.contentType,
    required this.size,
    required this.uploadedBy,
    required this.createdAt,
    required this.canManage,
  });

  factory StaffFile.fromJson(Map<String, dynamic> j) => StaffFile(
        id: j['id'] as String,
        fileName: j['fileName'] as String,
        contentType: j['contentType'] as String? ?? '',
        size: (j['size'] as num?)?.toInt() ?? 0,
        uploadedBy: j['uploadedBy'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String).toLocal(),
        canManage: j['canManage'] == true,
      );
}

/// GET /staff-documents/folders/:id/files.
class FolderContents {
  final StaffFolder folder;
  final List<StaffFile> files;

  const FolderContents({required this.folder, required this.files});

  factory FolderContents.fromJson(Map<String, dynamic> j) {
    final f = j['folder'] as Map<String, dynamic>;
    final files = [for (final e in j['files'] as List<dynamic>? ?? []) StaffFile.fromJson(e as Map<String, dynamic>)];
    return FolderContents(
      folder: StaffFolder(
        id: f['id'] as String,
        name: f['name'] as String,
        fileCount: files.length,
        createdBy: null,
        canManage: f['canManage'] == true,
      ),
      files: files,
    );
  }
}

/// "471 KB" / "2.3 MB".
String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
}
