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
  final String name;
  final String? pickupTime;
  final String? dropTime;

  const BusStop({required this.name, this.pickupTime, this.dropTime});

  static BusStop? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return BusStop(
      name: json['name'] as String,
      pickupTime: json['pickupTime'] as String?,
      dropTime: json['dropTime'] as String?,
    );
  }
}

class ChildBus {
  final String routeName;
  final String? vehicleNumber;
  final BusStop? stop;
  final BusContact? driver;
  final BusContact? attendant;

  const ChildBus({required this.routeName, this.vehicleNumber, this.stop, this.driver, this.attendant});

  factory ChildBus.fromJson(Map<String, dynamic> json) => ChildBus(
        routeName: json['routeName'] as String,
        vehicleNumber: json['vehicleNumber'] as String?,
        stop: BusStop.fromJson(json['stop']),
        driver: BusContact.fromJson(json['driver']),
        attendant: BusContact.fromJson(json['attendant']),
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
