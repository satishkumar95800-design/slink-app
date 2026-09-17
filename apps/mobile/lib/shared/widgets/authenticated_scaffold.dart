import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/branding_repository.dart';

/// A [Scaffold] that paints the tenant's background image (uploaded by the
/// school admin) behind the body, with a scrim so existing content stays
/// legible. Falls back to a plain [Scaffold] when no background is set.
class AuthenticatedScaffold extends ConsumerWidget {
  final PreferredSizeWidget? appBar;
  final Widget body;

  const AuthenticatedScaffold({super.key, this.appBar, required this.body});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final backgroundUrl = ref.watch(brandingProvider).valueOrNull?.backgroundImageUrl;

    if (backgroundUrl == null || backgroundUrl.isEmpty) {
      return Scaffold(appBar: appBar, body: body);
    }

    return Scaffold(
      appBar: appBar,
      body: Stack(
        fit: StackFit.expand,
        children: [
          CachedNetworkImage(
            imageUrl: backgroundUrl,
            fit: BoxFit.cover,
            errorWidget: (_, __, ___) => const SizedBox.shrink(),
          ),
          Container(color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.85)),
          body,
        ],
      ),
    );
  }
}
