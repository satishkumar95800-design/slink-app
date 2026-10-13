import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/theme/app_theme.dart';

/// Shared building blocks for the visual design: the curved teal header, feature
/// tiles, icon badges, pills, progress bars and empty states.

bool _isDark(BuildContext context) => Theme.of(context).brightness == Brightness.dark;

/// A zero-height app bar that paints the status bar teal with light icons, for
/// screens whose own [HeroHeader] sits at the top instead of an [AppBar].
PreferredSizeWidget statusBarOnly(BuildContext context) => AppBar(
      toolbarHeight: 0,
      shape: const RoundedRectangleBorder(),
      backgroundColor: _isDark(context) ? const Color(0xFF0E2B29) : AppColors.teal,
      systemOverlayStyle: SystemUiOverlayStyle.light,
    );

/// Teal header with a curved lower edge and soft decorative circles. Content
/// placed after it can be pulled up over the curve with [OverlapUp].
class HeroHeader extends StatelessWidget {
  final Widget child;

  /// Extra space at the bottom for the card that overlaps the header.
  final double overlap;

  const HeroHeader({super.key, required this.child, this.overlap = 0});

  @override
  Widget build(BuildContext context) {
    final dark = _isDark(context);
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: dark
                ? const [Color(0xFF0E2B29), AppColors.tealDeep]
                : const [AppColors.teal, AppColors.tealLight],
          ),
        ),
        child: Stack(
          children: [
            Positioned(right: -40, top: -50, child: _Blob(size: 170, color: AppColors.coral.withValues(alpha: 0.18))),
            Positioned(left: -30, bottom: -60, child: _Blob(size: 140, color: Colors.white.withValues(alpha: 0.06))),
            Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 24 + overlap),
              child: DefaultTextStyle.merge(style: const TextStyle(color: Colors.white), child: child),
            ),
          ],
        ),
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  final double size;
  final Color color;

  const _Blob({required this.size, required this.color});

  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

/// Shifts [child] up by [by] so it overlaps the [HeroHeader] above it.
class OverlapUp extends StatelessWidget {
  final double by;
  final Widget child;

  const OverlapUp({super.key, required this.by, required this.child});

  @override
  Widget build(BuildContext context) => Transform.translate(offset: Offset(0, -by), child: child);
}

/// Round icon button for the header (notifications, profile).
class HeaderIconButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const HeaderIconButton({super.key, required this.icon, required this.tooltip, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.12),
      shape: const CircleBorder(),
      child: IconButton(
        tooltip: tooltip,
        icon: Icon(icon, color: Colors.white, size: 22),
        onPressed: onPressed,
      ),
    );
  }
}

/// A white card with a soft shadow — for the headline cards on the home screens.
class SoftCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  const SoftCard({super.key, required this.child, this.padding = const EdgeInsets.all(18), this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    final dark = _isDark(context);
    final radius = BorderRadius.circular(24);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: dark
            ? null
            : [BoxShadow(color: AppColors.teal.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: color ?? Theme.of(context).colorScheme.surface,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      ),
    );
  }
}

/// A coloured icon on a soft tint of the same colour.
class IconBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;

  const IconBadge({super.key, required this.icon, required this.color, this.size = 44});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: _isDark(context) ? 0.22 : 0.13),
        borderRadius: BorderRadius.circular(size * 0.32),
      ),
      child: Icon(icon, color: color, size: size * 0.52),
    );
  }
}

/// Small rounded status label ("Overdue", "Paid", "Read").
class StatusPill extends StatelessWidget {
  final String label;
  final Color color;
  final IconData? icon;

  const StatusPill({super.key, required this.label, required this.color, this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: _isDark(context) ? 0.25 : 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 13, color: color), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

/// One square entry in a [FeatureGrid]: an icon badge, a label and an optional
/// one-line caption (live data such as "₹12,000" or "18/20").
class FeatureTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final String? caption;

  /// Shows a small count bubble on the icon; a dot when 0 and [alert] is set.
  final int? badge;
  final bool alert;

  const FeatureTile({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.caption,
    this.badge,
    this.alert = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = _isDark(context);
    final radius = BorderRadius.circular(22);
    final showBubble = (badge ?? 0) > 0 || alert;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: dark
            ? null
            : [BoxShadow(color: AppColors.teal.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: Material(
        color: theme.colorScheme.surface,
        borderRadius: radius,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 16, 8, 14),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconBadge(icon: icon, color: color, size: 52),
                    if (showBubble)
                      Positioned(
                        right: -6,
                        top: -6,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                          padding: const EdgeInsets.symmetric(horizontal: 5),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: alert ? const Color(0xFFDC2626) : AppColors.coral,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: theme.colorScheme.surface, width: 2),
                          ),
                          child: (badge ?? 0) > 0
                              ? Text(badge! > 9 ? '9+' : '$badge',
                                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800))
                              : null,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800, fontSize: 13),
                ),
                if (caption != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    caption!,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w800),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Lays tiles out in equal-height rows: three across on phones, two on very
/// narrow screens (longer Kannada/Hindi labels wrap rather than clip).
class FeatureGrid extends StatelessWidget {
  final List<Widget> tiles;
  final double spacing;

  const FeatureGrid({super.key, required this.tiles, this.spacing = 12});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth < 330 ? 2 : 3;
      final rows = <Widget>[];
      for (var i = 0; i < tiles.length; i += columns) {
        final cells = <Widget>[];
        for (var c = 0; c < columns; c++) {
          if (c > 0) cells.add(SizedBox(width: spacing));
          final index = i + c;
          cells.add(Expanded(child: index < tiles.length ? tiles[index] : const SizedBox.shrink()));
        }
        if (rows.isNotEmpty) rows.add(SizedBox(height: spacing));
        rows.add(IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: cells),
        ));
      }
      return Column(children: rows);
    });
  }
}

/// Bold section title with an optional trailing action.
class SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionHeader({super.key, required this.title, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (actionLabel != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
              child: Text(actionLabel!),
            ),
        ],
      ),
    );
  }
}

/// Thick rounded progress bar.
class RoundedBar extends StatelessWidget {
  final double value;
  final Color color;
  final double height;

  const RoundedBar({super.key, required this.value, required this.color, this.height = 10});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: LinearProgressIndicator(
        value: value.clamp(0, 1).toDouble(),
        minHeight: height,
        color: color,
        backgroundColor: _isDark(context) ? Colors.white12 : const Color(0xFFEFEAE4),
      ),
    );
  }
}

/// A progress ring with text in the middle (attendance %).
class RingStat extends StatelessWidget {
  final double value;
  final Color color;
  final String centerText;
  final double size;

  const RingStat({super.key, required this.value, required this.color, required this.centerText, this.size = 64});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        fit: StackFit.expand,
        children: [
          CircularProgressIndicator(
            value: value.clamp(0, 1).toDouble(),
            strokeWidth: size * 0.11,
            strokeCap: StrokeCap.round,
            color: color,
            backgroundColor: _isDark(context) ? Colors.white12 : const Color(0xFFEFEAE4),
          ),
          Center(
            child: Text(
              centerText,
              style: TextStyle(fontWeight: FontWeight.w900, fontSize: size * 0.22, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

/// Centered icon + message (+ optional action), scrollable so pull-to-refresh
/// still works on an empty list.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  final Color? color;
  final String? actionLabel;
  final VoidCallback? onAction;

  const EmptyState({super.key, required this.icon, required this.message, this.color, this.actionLabel, this.onAction});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.teal;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(32, 96, 32, 32),
      children: [
        Center(child: IconBadge(icon: icon, color: _isDark(context) && c == AppColors.teal ? Colors.white70 : c, size: 84)),
        const SizedBox(height: 20),
        Text(message, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
        if (actionLabel != null) ...[
          const SizedBox(height: 16),
          Center(child: OutlinedButton(onPressed: onAction, child: Text(actionLabel!))),
        ],
      ],
    );
  }
}

/// Grey placeholder blocks with a shimmer, shown while a card loads.
class LoadingBlock extends StatelessWidget {
  final double height;

  const LoadingBlock({super.key, this.height = 120});

  @override
  Widget build(BuildContext context) {
    final dark = _isDark(context);
    return Shimmer.fromColors(
      baseColor: dark ? Colors.white10 : const Color(0xFFEDE5DB),
      highlightColor: dark ? Colors.white24 : const Color(0xFFF8F3EE),
      child: Container(
        height: height,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
      ),
    );
  }
}

/// Initial-letter avatar.
class InitialAvatar extends StatelessWidget {
  final String name;
  final double radius;
  final Color? background;
  final Color? foreground;

  const InitialAvatar({super.key, required this.name, this.radius = 18, this.background, this.foreground});

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty ? '?' : name.trim().characters.first.toUpperCase();
    return CircleAvatar(
      radius: radius,
      backgroundColor: background ?? AppColors.coral,
      child: Text(initial,
          style: TextStyle(color: foreground ?? Colors.white, fontWeight: FontWeight.w800, fontSize: radius * 0.9)),
    );
  }
}

/// A list row in card form: icon badge, title, subtitle, trailing.
class ListCard extends StatelessWidget {
  final Widget leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final int subtitleLines;

  const ListCard({
    super.key,
    required this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.subtitleLines = 2,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              leading,
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!,
                          maxLines: subtitleLines,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(color: _isDark(context) ? Colors.white70 : AppColors.muted)),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}

/// Small grey date label used as a trailing on list cards.
class DateLabel extends StatelessWidget {
  final String text;

  const DateLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: _isDark(context) ? Colors.white60 : AppColors.muted,
              fontWeight: FontWeight.w700,
            ),
      );
}
