import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/services/branding_repository.dart';
import '../../shared/widgets/ui_kit.dart';

/// Contents of the home screen's teal header: "Hi, Priya 👋", the school name,
/// notification and profile buttons, then an optional [bottom] (child switcher
/// for parents, Now/Next strip for teachers).
class HomeHeader extends ConsumerWidget {
  final String name;
  final Widget? bottom;

  const HomeHeader({super.key, required this.name, this.bottom});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final schoolName = ref.watch(brandingProvider).valueOrNull?.name;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          l.dashboardGreeting(name),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.headlineSmall
                              ?.copyWith(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: -0.3),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('👋', style: TextStyle(fontSize: 22)),
                    ],
                  ),
                  if (schoolName != null && schoolName.isNotEmpty)
                    Text(
                      schoolName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
            ),
            HeaderIconButton(
              icon: Icons.notifications_none_rounded,
              tooltip: l.notificationsTitle,
              onPressed: () => context.push('/dashboard/notifications'),
            ),
            const SizedBox(width: 8),
            Tooltip(
              message: l.profileTitle,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => context.push('/profile'),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                  child: InitialAvatar(name: name, radius: 20),
                ),
              ),
            ),
          ],
        ),
        if (bottom != null) ...[const SizedBox(height: 18), bottom!],
      ],
    );
  }
}
