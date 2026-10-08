import 'package:flutter/material.dart';
import 'attendance_models.dart';

/// One colour per status, shared by the marking screen and the parent calendar.
abstract final class AttendanceColors {
  static const present = Color(0xFF2E7D32);
  static const absent = Color(0xFFC62828);
  static const late = Color(0xFFEF8F00);
  static const leave = Color(0xFF1565C0);
  static const holiday = Color(0xFF9E9E9E);

  static Color of(AttendanceStatus status) => switch (status) {
        AttendanceStatus.present => present,
        AttendanceStatus.absent => absent,
        AttendanceStatus.late => late,
        AttendanceStatus.leave => leave,
      };
}
