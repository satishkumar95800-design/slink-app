import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';

/// A bus on the map: where it is, and whether its signal is fresh.
class BusMarker {
  final String id;
  final double lat;
  final double lng;
  final double? heading;
  final bool stale;
  final String? label;

  const BusMarker({required this.id, required this.lat, required this.lng, this.heading, this.stale = false, this.label});

  LatLng get point => LatLng(lat, lng);
}

/// OpenStreetMap with the buses on it. Follows a single bus as it moves; fits
/// several buses into view.
class BusMap extends StatefulWidget {
  final List<BusMarker> buses;

  const BusMap({super.key, required this.buses});

  @override
  State<BusMap> createState() => _BusMapState();
}

class _BusMapState extends State<BusMap> {
  final _controller = MapController();
  bool _ready = false;

  @override
  void didUpdateWidget(covariant BusMap old) {
    super.didUpdateWidget(old);
    if (_ready) _frame();
  }

  void _frame() {
    final b = widget.buses;
    if (b.isEmpty) return;
    if (b.length == 1) {
      _controller.move(b.first.point, _controller.camera.zoom < 13 ? 16 : _controller.camera.zoom);
    } else {
      _controller.fitCamera(CameraFit.coordinates(coordinates: [for (final m in b) m.point], padding: const EdgeInsets.all(48)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final first = widget.buses.isEmpty ? null : widget.buses.first.point;
    return FlutterMap(
      mapController: _controller,
      options: MapOptions(
        initialCenter: first ?? const LatLng(12.9716, 77.5946),
        initialZoom: first == null ? 11 : 16,
        onMapReady: () {
          _ready = true;
          _frame();
        },
        interactionOptions: const InteractionOptions(flags: InteractiveFlag.all & ~InteractiveFlag.rotate),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.slink.school',
        ),
        MarkerLayer(
          markers: [
            for (final b in widget.buses)
              Marker(
                point: b.point,
                width: 120,
                height: 64,
                child: _BusPin(bus: b),
              ),
          ],
        ),
        SimpleAttributionWidget(
          source: Text(context.l10n.mapAttribution),
          onTap: () => launchUrl(Uri.parse('https://www.openstreetmap.org/copyright'), mode: LaunchMode.externalApplication),
        ),
      ],
    );
  }
}

class _BusPin extends StatelessWidget {
  final BusMarker bus;

  const _BusPin({required this.bus});

  @override
  Widget build(BuildContext context) {
    final color = bus.stale ? AppColors.muted : FeatureColors.bus;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (bus.label != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: const [
              BoxShadow(color: Colors.black26, blurRadius: 4),
            ]),
            child: Text(bus.label!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        const SizedBox(height: 2),
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
          ),
          child: const Icon(Icons.directions_bus_rounded, color: Colors.white, size: 20),
        ),
      ],
    );
  }
}
