import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/models/api_exception.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import 'school_bus_models.dart';
import 'school_bus_repository.dart';

/// The parent's child's bus: route, stop and times, and the driver to call.
class ChildBusPage extends ConsumerWidget {
  final String studentId;

  const ChildBusPage({super.key, required this.studentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final async = ref.watch(childBusProvider(studentId));
    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.busTitle)),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(childBusProvider(studentId).future),
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [LoadingBlock(height: 90), SizedBox(height: 10), LoadingBlock(height: 120)],
          ),
          error: (e, _) => EmptyState(
            icon: Icons.cloud_off_rounded,
            message: describeError(e),
            color: FeatureColors.sent,
            actionLabel: l.commonRetry,
            onAction: () => ref.invalidate(childBusProvider(studentId)),
          ),
          data: (info) {
            final bus = info.bus;
            if (bus == null) {
              return EmptyState(icon: Icons.directions_bus_rounded, message: l.busNotOnRoute(info.studentName), color: FeatureColors.bus);
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _RouteCard(bus: bus),
                const SizedBox(height: 12),
                _StopCard(stop: bus.stop),
                const SizedBox(height: 12),
                if (bus.driver == null)
                  SoftCard(child: Text(l.busNoDriver, style: const TextStyle(color: AppColors.muted)))
                else
                  _ContactCard(role: l.busDriver, contact: bus.driver!),
                if (bus.attendant != null) ...[
                  const SizedBox(height: 12),
                  _ContactCard(role: l.busAttendant, contact: bus.attendant!),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final ChildBus bus;

  const _RouteCard({required this.bus});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      child: Row(
        children: [
          const IconBadge(icon: Icons.directions_bus_rounded, color: FeatureColors.bus, size: 52),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(bus.routeName, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                if (bus.vehicleNumber != null) ...[
                  const SizedBox(height: 2),
                  Text(context.l10n.busVehicle(bus.vehicleNumber!), style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StopCard extends StatelessWidget {
  final BusStop? stop;

  const _StopCard({required this.stop});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final s = stop;
    return SoftCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const IconBadge(icon: Icons.place_rounded, color: FeatureColors.calendar),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.busStop, style: theme.textTheme.labelMedium?.copyWith(color: AppColors.muted)),
                const SizedBox(height: 2),
                if (s == null)
                  Text(l.busNoStop, style: theme.textTheme.bodyMedium)
                else ...[
                  Text(s.name, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  if (s.pickupTime != null || s.dropTime != null) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        if (s.pickupTime != null) _TimeChip(icon: Icons.wb_sunny_rounded, text: l.busPickup(s.pickupTime!)),
                        if (s.dropTime != null) _TimeChip(icon: Icons.home_rounded, text: l.busDrop(s.dropTime!)),
                      ],
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  final IconData icon;
  final String text;

  const _TimeChip({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: FeatureColors.bus.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: FeatureColors.bus),
          const SizedBox(width: 5),
          Text(text, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  final String role;
  final BusContact contact;

  const _ContactCard({required this.role, required this.contact});

  Future<void> _call(BuildContext context, String phone) async {
    final messenger = ScaffoldMessenger.of(context);
    final failed = context.l10n.busCouldNotCall;
    final ok = await launchUrl(Uri(scheme: 'tel', path: phone));
    if (!ok) messenger.showSnackBar(SnackBar(content: Text(failed)));
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final phone = contact.phone;
    return SoftCard(
      child: Row(
        children: [
          const IconBadge(icon: Icons.person_rounded, color: FeatureColors.classes),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(role, style: theme.textTheme.labelMedium?.copyWith(color: AppColors.muted)),
                const SizedBox(height: 2),
                Text(contact.name, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                if (phone != null) Text(phone, style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.muted)),
              ],
            ),
          ),
          if (phone != null)
            Semantics(
              label: l.busCallName(contact.name),
              button: true,
              child: FilledButton.icon(
                onPressed: () => _call(context, phone),
                icon: const Icon(Icons.call_rounded, size: 18),
                label: Text(l.busCall),
              ),
            ),
        ],
      ),
    );
  }
}
