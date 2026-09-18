import 'package:flutter/material.dart';

/// Renders a received notice/homework notification straight from its FCM data
/// payload — there's no GET-by-id endpoint for these (they're logged
/// server-side as Notification rows, but not exposed for parents to browse
/// yet), so this only shows what arrived with the push.
class NoticeDetailPage extends StatelessWidget {
  final String title;
  final String body;
  final String? attachmentUrl;

  const NoticeDetailPage({
    super.key,
    required this.title,
    required this.body,
    this.attachmentUrl,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (attachmentUrl != null && attachmentUrl!.isNotEmpty) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(attachmentUrl!, fit: BoxFit.cover),
              ),
              const SizedBox(height: 16),
            ],
            Text(body, style: Theme.of(context).textTheme.bodyLarge),
          ],
        ),
      ),
    );
  }
}
