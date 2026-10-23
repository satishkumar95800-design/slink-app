import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/active_user.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/ui_kit.dart';
import '../dashboard/home_header.dart';
import '../school_bus/school_bus_models.dart';
import 'driver_trip.dart';

const _overlap = 36.0;

/// The bus driver's home: their routes, and Start trip / End trip. While a
/// trip runs the phone shares its location with the parents on that route.
class DriverHomeBody extends ConsumerStatefulWidget {
  final ActiveUser user;

  const DriverHomeBody({super.key, required this.user});

  @override
  ConsumerState<DriverHomeBody> createState() => _DriverHomeBodyState();
}

class _DriverHomeBodyState extends ConsumerState<DriverHomeBody> {
  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final async = ref.watch(driverHomeProvider);
    final trip = ref.watch(driverTripProvider);

    // A trip running on the server (e.g. the app was closed): keep sharing.
    ref.listen(driverHomeProvider, (_, next) {
      final home = next.valueOrNull;
      if (home != null) ref.read(driverTripProvider.notifier).resume(home.trip);
    });

    return RefreshIndicator(
      onRefresh: () => ref.refresh(driverHomeProvider.future),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          HeroHeader(overlap: _overlap, child: HomeHeader(name: widget.user.name)),
          OverlapUp(
            by: _overlap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: async.when(
                loading: () => const Column(children: [LoadingBlock(height: 160), SizedBox(height: 12), LoadingBlock(height: 120)]),
                error: (e, _) => SoftCard(
                  child: Column(
                    children: [
                      Text(describeError(e), textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      OutlinedButton(onPressed: () => ref.invalidate(driverHomeProvider), child: Text(l.commonRetry)),
                    ],
                  ),
                ),
                data: (home) {
                  if (home.routes.isEmpty) {
                    return SoftCard(
                      child: Column(
                        children: [
                          const IconBadge(icon: Icons.directions_bus_rounded, color: FeatureColors.bus, size: 64),
                          const SizedBox(height: 12),
                          Text(l.driverNoRoutes, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                        ],
                      ),
                    );
                  }
                  final running = trip.trip;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (trip.problem != null) ...[_ProblemCard(problem: trip.problem!), const SizedBox(height: 12)],
                      if (running != null)
                        _RunningCard(
                          state: trip,
                          route: home.routes.where((r) => r.id == (trip.routeId ?? running.routeId)).firstOrNull,
                        )
                      else
                        for (final r in home.routes) ...[_RouteCard(route: r, busy: trip.busy), const SizedBox(height: 12)],
                      const SizedBox(height: 4),
                      Text(l.driverTip, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted)),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends ConsumerWidget {
  final DriverRoute route;
  final bool busy;

  const _RouteCard({required this.route, required this.busy});

  Future<void> _start(BuildContext context, WidgetRef ref, String direction) async {
    try {
      await ref.read(driverTripProvider.notifier).start(route.id, direction);
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeError(e))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final morning = DateTime.now().hour < 12;
    final first = route.stops.isEmpty ? null : route.stops.first;
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const IconBadge(icon: Icons.directions_bus_rounded, color: FeatureColors.bus),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(route.name, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                    Text(
                      [if (route.vehicleNumber != null) route.vehicleNumber!, l.driverStopsAndChildren(route.stops.length, route.studentCount)].join(' · '),
                      style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (first != null) ...[
            const SizedBox(height: 10),
            Text(l.driverFirstStop(first.name, (morning ? first.pickupTime : first.dropTime) ?? '—'),
                style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
          ],
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : () => _start(context, ref, morning ? 'pickup' : 'drop'),
            icon: const Icon(Icons.play_arrow_rounded),
            label: Text(morning ? l.driverStartPickup : l.driverStartDrop),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: busy ? null : () => _start(context, ref, morning ? 'drop' : 'pickup'),
            child: Text(morning ? l.driverStartDrop : l.driverStartPickup),
          ),
        ],
      ),
    );
  }
}

class _RunningCard extends ConsumerWidget {
  final DriverTripState state;
  final DriverRoute? route;

  const _RunningCard({required this.state, this.route});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final trip = state.trip!;
    final sent = state.lastSentAt;
    return SoftCard(
      color: FeatureColors.attendance.withValues(alpha: 0.10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const _Pulse(),
              const SizedBox(width: 12),
              Expanded(
                child: Text(l.driverSharingNow, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            [if (route != null) route!.name, trip.isPickup ? l.busTripPickup : l.busTripDrop].join(' · '),
            style: theme.textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            sent == null ? l.driverWaitingGps : l.driverLastSent(DateFormat.jms().format(sent)),
            style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: AppColors.coral, minimumSize: const Size.fromHeight(52)),
            onPressed: state.busy
                ? null
                : () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        title: Text(l.driverEndTripTitle),
                        content: Text(l.driverEndTripBody),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(l.commonCancel)),
                          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(l.driverEndTrip)),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    try {
                      await ref.read(driverTripProvider.notifier).end();
                      ref.invalidate(driverHomeProvider);
                    } catch (e) {
                      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(describeError(e))));
                    }
                  },
            icon: const Icon(Icons.stop_rounded),
            label: Text(l.driverEndTrip),
          ),
        ],
      ),
    );
  }
}

class _ProblemCard extends ConsumerWidget {
  final LocationProblem problem;

  const _ProblemCard({required this.problem});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final text = switch (problem) {
      LocationProblem.serviceOff => l.driverLocationOff,
      LocationProblem.denied => l.driverLocationDenied,
      LocationProblem.deniedForever => l.driverLocationBlocked,
    };
    return SoftCard(
      color: AppColors.coral.withValues(alpha: 0.10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.location_off_rounded, color: AppColors.coral),
              const SizedBox(width: 10),
              Expanded(child: Text(text)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (problem != LocationProblem.denied)
                TextButton(
                  onPressed: () => problem == LocationProblem.serviceOff ? Geolocator.openLocationSettings() : Geolocator.openAppSettings(),
                  child: Text(l.driverOpenSettings),
                ),
              FilledButton(onPressed: () => ref.read(driverTripProvider.notifier).retryLocation(), child: Text(l.commonRetry)),
            ],
          ),
        ],
      ),
    );
  }
}

/// A softly pulsing green dot: "live".
class _Pulse extends StatefulWidget {
  const _Pulse();

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.35, end: 1.0).animate(_c),
      child: Container(
        width: 14,
        height: 14,
        decoration: const BoxDecoration(color: FeatureColors.attendance, shape: BoxShape.circle),
      ),
    );
  }
}
