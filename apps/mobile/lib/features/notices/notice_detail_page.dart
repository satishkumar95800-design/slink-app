import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/services/broadcast_repository.dart';

class NoticeAttachment {
  final String url;
  final bool isPdf;

  const NoticeAttachment({required this.url, required this.isPdf});

  /// From a list item ({url, contentType}) or a bare URL (push payloads carry only the first).
  factory NoticeAttachment.fromAny(Object raw) {
    if (raw is Map) {
      return NoticeAttachment(url: raw['url'] as String, isPdf: raw['contentType'] == 'application/pdf');
    }
    final url = raw.toString();
    return NoticeAttachment(url: url, isPdf: (Uri.tryParse(url)?.path ?? url).toLowerCase().endsWith('.pdf'));
  }
}

/// A notice or homework item: text, up to 3 photos or a PDF. Opening it tells
/// the server this parent has seen it (§4.3 "Seen by X/Y parents").
class NoticeDetailPage extends ConsumerStatefulWidget {
  final String title;
  final String body;
  final List<NoticeAttachment> attachments;
  final String? broadcastId;

  const NoticeDetailPage({
    super.key,
    required this.title,
    required this.body,
    this.attachments = const [],
    this.broadcastId,
  });

  @override
  ConsumerState<NoticeDetailPage> createState() => _NoticeDetailPageState();
}

class _NoticeDetailPageState extends ConsumerState<NoticeDetailPage> {
  @override
  void initState() {
    super.initState();
    final id = widget.broadcastId;
    // Teachers opening their own items don't count — the API only records parents.
    if (id != null && id.isNotEmpty) {
      ref.read(broadcastRepositoryProvider).markSeen(id).catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.body, style: Theme.of(context).textTheme.bodyLarge),
            for (final a in widget.attachments) ...[
              const SizedBox(height: 16),
              if (a.isPdf)
                OutlinedButton.icon(
                  onPressed: () => launchUrl(Uri.parse(a.url), mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(context.l10n.noticeOpenPdf),
                )
              else
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(
                    imageUrl: a.url,
                    cacheKey: Uri.tryParse(a.url)?.path,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    errorWidget: (_, __, ___) => const Padding(
                      padding: EdgeInsets.all(24),
                      child: Icon(Icons.broken_image_outlined),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
