import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/services/branding_repository.dart';
import '../../shared/widgets/ui_kit.dart';
import '../auth/session_controller.dart';

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
        if (ref.watch(sessionControllerProvider.select((s) => s.canSwitchToParent))) ...[
          const SizedBox(height: 14),
          const _ModeSwitch(),
        ],
        if (bottom != null) ...[const SizedBox(height: 18), bottom!],
      ],
    );
  }
}

/// Staff | Parent switch for a staff member whose own children study at the
/// school. Switching rebuilds the app on the matching home screen.
class _ModeSwitch extends ConsumerWidget {
  const _ModeSwitch();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final asParent = ref.watch(sessionControllerProvider.select((s) => s.actingAsParent));

    Widget segment(String label, IconData icon, bool selected, bool toParent) => Expanded(
          child: Semantics(
            button: true,
            selected: selected,
            child: InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: selected ? null : () => ref.read(sessionControllerProvider.notifier).setActingAsParent(toParent),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 18, color: selected ? Theme.of(context).colorScheme.primary : Colors.white),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: selected ? Theme.of(context).colorScheme.primary : Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(999)),
      child: Row(
        children: [
          segment(l.modeStaff, Icons.badge_rounded, !asParent, false),
          segment(l.modeParent, Icons.family_restroom_rounded, asParent, true),
        ],
      ),
    );
  }
}
