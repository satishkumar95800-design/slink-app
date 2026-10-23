/// A driver or attendant a parent can call.
class BusContact {
  final String name;
  final String? phone;

  const BusContact({required this.name, this.phone});

  static BusContact? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return BusContact(name: json['name'] as String, phone: json['phone'] as String?);
  }
}

class BusStop {
  /// Set on the driver's routes (not on a parent's view).
  final String? id;
  final String name;
  final String? pickupTime;
  final String? dropTime;

  /// The stop has a saved location (driver's routes only).
  final bool located;

  const BusStop({this.id, required this.name, this.pickupTime, this.dropTime, this.located = false});

  static BusStop? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return BusStop(
      id: json['id'] as String?,
      name: json['name'] as String,
      pickupTime: json['pickupTime'] as String?,
      dropTime: json['dropTime'] as String?,
      located: json['located'] == true,
    );
  }
}

class ChildBus {
  final String routeName;
  final String? vehicleNumber;
  final BusStop? stop;
  final BusContact? driver;
  final BusContact? attendant;

  /// The bus company's own tracking page, when the school added one.
  final String? trackingUrl;

  const ChildBus({required this.routeName, this.vehicleNumber, this.stop, this.driver, this.attendant, this.trackingUrl});

  factory ChildBus.fromJson(Map<String, dynamic> json) => ChildBus(
        routeName: json['routeName'] as String,
        vehicleNumber: json['vehicleNumber'] as String?,
        stop: BusStop.fromJson(json['stop']),
        driver: BusContact.fromJson(json['driver']),
        attendant: BusContact.fromJson(json['attendant']),
        trackingUrl: json['trackingUrl'] as String?,
      );
}

/// GET /transport/child/:studentId: [bus] is null when the child isn't on a route.
class ChildBusInfo {
  final String studentName;
  final ChildBus? bus;

  const ChildBusInfo({required this.studentName, this.bus});

  factory ChildBusInfo.fromJson(Map<String, dynamic> json) => ChildBusInfo(
        studentName: (json['student'] as Map<String, dynamic>)['name'] as String,
        bus: json['bus'] is Map<String, dynamic> ? ChildBus.fromJson(json['bus'] as Map<String, dynamic>) : null,
      );
}

/// The bus's latest GPS fix.
class BusPosition {
  final double lat;
  final double lng;
  final double? speed;
  final double? heading;
  final DateTime at;

  const BusPosition({required this.lat, required this.lng, this.speed, this.heading, required this.at});

  static BusPosition? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return BusPosition(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      at: DateTime.parse(json['at'] as String).toLocal(),
    );
  }
}

/// When the bus reaches the parent's child's stop: [reached], or about [minutes].
class BusEta {
  final int? minutes;
  final bool reached;

  const BusEta({this.minutes, required this.reached});

  static BusEta? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return BusEta(minutes: json['minutes'] as int?, reached: json['reached'] == true);
  }
}

/// A trip a driver is running: [stale] when no fix came for a few minutes.
class LiveTrip {
  final String id;
  final String direction;
  final DateTime startedAt;
  final bool stale;
  final BusPosition? position;
  final String? routeId;

  /// Parent's view: arrival at their child's stop, null when unknown.
  final BusEta? eta;

  /// Driver's view: stops reached on this trip.
  final List<String> reachedStopIds;

  const LiveTrip({
    required this.id,
    required this.direction,
    required this.startedAt,
    required this.stale,
    this.position,
    this.routeId,
    this.eta,
    this.reachedStopIds = const [],
  });

  bool get isPickup => direction == 'pickup';

  static LiveTrip? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return LiveTrip(
      id: json['id'] as String,
      direction: json['direction'] as String,
      startedAt: DateTime.parse(json['startedAt'] as String).toLocal(),
      stale: json['state'] == 'stale',
      position: BusPosition.fromJson(json['position']),
      routeId: json['routeId'] as String?,
      eta: BusEta.fromJson(json['eta']),
      reachedStopIds: [for (final id in (json['reachedStopIds'] as List?) ?? const []) id as String],
    );
  }
}

/// GET /transport/child/:studentId/live.
class ChildBusLive {
  final ChildBus? bus;
  final LiveTrip? trip;

  const ChildBusLive({this.bus, this.trip});

  factory ChildBusLive.fromJson(Map<String, dynamic> json) => ChildBusLive(
        bus: json['bus'] is Map<String, dynamic> ? ChildBus.fromJson(json['bus'] as Map<String, dynamic>) : null,
        trip: LiveTrip.fromJson(json['trip']),
      );
}

/// One route on GET /transport/live (admin).
class LiveRoute {
  final String id;
  final String name;
  final String? vehicleNumber;
  final BusContact? driver;
  final LiveTrip? trip;

  const LiveRoute({required this.id, required this.name, this.vehicleNumber, this.driver, this.trip});

  factory LiveRoute.fromJson(Map<String, dynamic> json) => LiveRoute(
        id: json['id'] as String,
        name: json['name'] as String,
        vehicleNumber: json['vehicleNumber'] as String?,
        driver: BusContact.fromJson(json['driver']),
        trip: LiveTrip.fromJson(json['trip']),
      );
}

/// A route the signed-in driver drives.
class DriverRoute {
  final String id;
  final String name;
  final String? vehicleNumber;
  final List<BusStop> stops;
  final int studentCount;

  const DriverRoute({required this.id, required this.name, this.vehicleNumber, required this.stops, required this.studentCount});

  factory DriverRoute.fromJson(Map<String, dynamic> json) => DriverRoute(
        id: json['id'] as String,
        name: json['name'] as String,
        vehicleNumber: json['vehicleNumber'] as String?,
        stops: [for (final s in json['stops'] as List) BusStop.fromJson(s)!],
        studentCount: json['studentCount'] as int,
      );
}

/// GET /transport/driver/me.
class DriverHome {
  final List<DriverRoute> routes;
  final LiveTrip? trip;

  const DriverHome({required this.routes, this.trip});

  factory DriverHome.fromJson(Map<String, dynamic> json) => DriverHome(
        routes: [for (final r in json['routes'] as List) DriverRoute.fromJson(r as Map<String, dynamic>)],
        trip: LiveTrip.fromJson(json['trip']),
      );
}
