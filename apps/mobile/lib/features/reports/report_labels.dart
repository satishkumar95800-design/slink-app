import 'package:flutter/material.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/models/report.dart';

String reportTypeLabel(AppLocalizations l, ReportType type) => switch (type) {
      ReportType.academic => l.reportTypeAcademic,
      ReportType.attendance => l.reportTypeAttendance,
      ReportType.behavior => l.reportTypeBehavior,
      ReportType.homework => l.reportTypeHomework,
      ReportType.reportCard => l.reportTypeReportCard,
    };

/// Same, from the API's raw value ("report_card", "academic", …).
String reportTypeLabelFromApi(AppLocalizations l, String raw) => switch (raw) {
      'academic' => l.reportTypeAcademic,
      'attendance' => l.reportTypeAttendance,
      'behavior' => l.reportTypeBehavior,
      'homework' => l.reportTypeHomework,
      'report_card' => l.reportTypeReportCard,
      _ => raw,
    };

IconData reportTypeIcon(ReportType type) => switch (type) {
      ReportType.academic => Icons.school_rounded,
      ReportType.attendance => Icons.event_available_rounded,
      ReportType.behavior => Icons.emoji_people_rounded,
      ReportType.homework => Icons.menu_book_rounded,
      ReportType.reportCard => Icons.picture_as_pdf_rounded,
    };

/// How full a subject's bar is on the report view: letter grades (A+ … F, CBSE
/// A1 … E2), percentages ("85", "85%") or marks ("42/50"). Null when the value
/// can't be read as a grade — the row then shows the value without a bar.
double? gradeFraction(Object? raw) {
  if (raw is num) return (raw <= 1 ? raw : raw / 100).clamp(0, 1).toDouble();
  if (raw is! String) return null;
  final s = raw.trim().toUpperCase();
  final number = RegExp(r'^(\d+(?:\.\d+)?)\s*(?:%|/\s*(\d+(?:\.\d+)?))?$').firstMatch(s);
  if (number != null) {
    final value = double.parse(number[1]!);
    final outOf = number[2] == null ? 100.0 : double.parse(number[2]!);
    return outOf <= 0 ? null : (value / outOf).clamp(0, 1).toDouble();
  }
  return _letterGrades[s];
}

const _letterGrades = <String, double>{
  'O': 1.0, 'A+': 0.97, 'A': 0.9, 'A-': 0.85, 'B+': 0.8, 'B': 0.74, 'B-': 0.68,
  'C+': 0.62, 'C': 0.56, 'C-': 0.5, 'D+': 0.45, 'D': 0.4, 'E': 0.3, 'F': 0.2,
  'A1': 0.97, 'A2': 0.9, 'B1': 0.82, 'B2': 0.74, 'C1': 0.66, 'C2': 0.58, 'D1': 0.5, 'D2': 0.42,
  'E1': 0.3, 'E2': 0.2,
};
