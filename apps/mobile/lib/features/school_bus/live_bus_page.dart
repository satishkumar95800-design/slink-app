import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'bus_map.dart';
import 'school_bus_models.dart';
import 'school_bus_repository.dart';

/// Polls an endpoint while the page is open (and stops when it closes).
mixin _Polling<T extends StatefulWidget> on State<T> {
  Timer? _timer;

  Duration get every;
  Future<void> poll();

  void startPolling() {
    poll();
    _timer = Timer.periodic(every, (_) => poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

String _ago(BuildContext context, DateTime at) {
  final l = context.l10n;
  final s = DateTime.now().difference(at).inSeconds;
  if (s < 60) return l.busUpdatedSeconds(s < 0 ? 0 : s);
  if (s < 3600) return l.busUpdatedMinutes(s ~/ 60);
  return l.busUpdatedAt(DateFormat.jm().format(at));
}

/// The parent's child's bus on a map while the driver runs a trip.
class LiveBusPage extends ConsumerStatefulWidget {
  final String studentId;

  const LiveBusPage({super.key, required this.studentId});

  @override
  ConsumerState<LiveBusPage> createState() => _LiveBusPageState();
}

class _LiveBusPageState extends ConsumerState<LiveBusPage> with _Polling {
  ChildBusLive? _data;
  Object? _error;

  @override
  Duration get every => const Duration(seconds: 10);

  @override
  Future<void> poll() async {
    try {
      final d = await ref.read(schoolBusRepositoryProvider).childLive(widget.studentId);
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void initState() {
    super.initState();
    startPolling();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final d = _data;
    final trip = d?.trip;
    final pos = trip?.position;
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.busLiveTitle)),
      body: d == null
          ? (_error != null
              ? EmptyState(icon: Icons.cloud_off_rounded, message: describeError(_error!), actionLabel: l.commonRetry, onAction: poll)
              : const Center(child: CircularProgressIndicator()))
          : d.bus == null
              ? EmptyState(icon: Icons.directions_bus_rounded, message: l.busLiveNoRoute, color: FeatureColors.bus)
              : Column(
                  children: [
                    Expanded(
                      child: pos == null
                          ? Container(
                              color: Theme.of(context).colorScheme.surfaceContainerHighest,
                              alignment: Alignment.center,
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const IconBadge(icon: Icons.directions_bus_rounded, color: FeatureColors.bus, size: 72),
                                  const SizedBox(height: 16),
                                  Text(trip == null ? l.busLiveNotRunning : l.busLiveWaitingGps,
                                      textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                                ],
                              ),
                            )
                          : BusMap(buses: [
                              BusMarker(id: trip!.id, lat: pos.lat, lng: pos.lng, heading: pos.heading, stale: trip.stale),
                            ]),
                    ),
                    _InfoPanel(bus: d.bus!, trip: trip),
                  ],
                ),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  final ChildBus bus;
  final LiveTrip? trip;

  const _InfoPanel({required this.bus, this.trip});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final t = trip;
    final pos = t?.position;
    final stop = bus.stop;
    final (status, color) = t == null
        ? (l.busLiveNotRunningShort, AppColors.muted)
        : t.stale
            ? (l.busLiveNoSignal, AppColors.coral)
            : (t.isPickup ? l.busLiveOnWayPickup : l.busLiveOnWayDrop, FeatureColors.attendance);
    return SafeArea(
      top: false,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12, offset: Offset(0, -2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                StatusPill(label: status, color: color),
                const Spacer(),
                if (pos != null) Text(_ago(context, pos.at), style: theme.textTheme.bodySmall?.copyWith(color: AppColors.muted)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              [bus.routeName, if (bus.vehicleNumber != null) bus.vehicleNumber!].join(' · '),
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            if (stop != null)
              Text(
                l.busLiveStop(stop.name, (t == null || t.isPickup ? stop.pickupTime : stop.dropTime) ?? '—'),
                style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted),
              ),
            if (bus.driver?.phone != null) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => launchUrl(Uri(scheme: 'tel', path: bus.driver!.phone)),
                  icon: const Icon(Icons.call_rounded),
                  label: Text(l.busCallDriver(bus.driver!.name)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Admin: every bus on a trip, on one map and in a list.
class AdminLiveBusesPage extends ConsumerStatefulWidget {
  const AdminLiveBusesPage({super.key});

  @override
  ConsumerState<AdminLiveBusesPage> createState() => _AdminLiveBusesPageState();
}

class _AdminLiveBusesPageState extends ConsumerState<AdminLiveBusesPage> with _Polling {
  List<LiveRoute>? _routes;
  Object? _error;

  @override
  Duration get every => const Duration(seconds: 15);

  @override
  Future<void> poll() async {
    try {
      final r = await ref.read(schoolBusRepositoryProvider).live();
      if (!mounted) return;
      setState(() {
        _routes = r;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void initState() {
    super.initState();
    startPolling();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final routes = _routes;
    final moving = routes?.where((r) => r.trip != null).toList() ?? const <LiveRoute>[];
    final onMap = [
      for (final r in moving)
        if (r.trip!.position != null)
          BusMarker(id: r.id, lat: r.trip!.position!.lat, lng: r.trip!.position!.lng, stale: r.trip!.stale, label: r.name),
    ];
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.adminLiveBuses)),
      body: routes == null
          ? (_error != null
              ? EmptyState(icon: Icons.cloud_off_rounded, message: describeError(_error!), actionLabel: l.commonRetry, onAction: poll)
              : const Center(child: CircularProgressIndicator()))
          : moving.isEmpty
              ? EmptyState(icon: Icons.directions_bus_rounded, message: l.busNoneMoving, color: FeatureColors.bus)
              : Column(
                  children: [
                    if (onMap.isNotEmpty) Expanded(flex: 3, child: BusMap(buses: onMap)),
                    Expanded(
                      flex: 2,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: moving.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, i) {
                          final r = moving[i];
                          final t = r.trip!;
                          return SoftCard(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: [
                                const IconBadge(icon: Icons.directions_bus_rounded, color: FeatureColors.bus, size: 38),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800)),
                                      Text(
                                        [
                                          t.isPickup ? l.busTripPickup : l.busTripDrop,
                                          if (r.driver != null) r.driver!.name,
                                          t.position == null ? l.busLiveWaitingGpsShort : _ago(context, t.position!.at),
                                        ].join(' · '),
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.muted),
                                      ),
                                    ],
                                  ),
                                ),
                                StatusPill(
                                  label: t.stale ? l.busLiveNoSignal : l.busMoving,
                                  color: t.stale ? AppColors.coral : FeatureColors.attendance,
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
    );
  }
}
