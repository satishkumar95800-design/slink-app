import 'package:flutter/material.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';

/// Matches the API's `type` on GET /calendar.
enum CalendarItemType {
  holiday('HOLIDAY'),
  event('EVENT'),
  ptm('PTM');

  final String wire;
  const CalendarItemType(this.wire);

  static CalendarItemType parse(String? value) =>
      CalendarItemType.values.firstWhere((t) => t.wire == value, orElse: () => CalendarItemType.event);

  /// One theme colour per type, used for the grid markers, legend and list icons.
  Color get color => switch (this) {
        CalendarItemType.holiday => AppColors.coral,
        CalendarItemType.event => FeatureColors.homework,
        CalendarItemType.ptm => FeatureColors.reports,
      };

  IconData get icon => switch (this) {
        CalendarItemType.holiday => Icons.beach_access_rounded,
        CalendarItemType.event => Icons.celebration_rounded,
        CalendarItemType.ptm => Icons.groups_rounded,
      };

  String label(BuildContext context) => switch (this) {
        CalendarItemType.holiday => context.l10n.calendarHoliday,
        CalendarItemType.event => context.l10n.calendarEvent,
        CalendarItemType.ptm => context.l10n.calendarPtm,
      };
}

/// "yyyy-MM-dd" key for a date — always Latin digits, whatever the UI language.
String dateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime parseDateKey(String ymd) {
  final p = ymd.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

class CalendarItem {
  final String id;
  final CalendarItemType type;
  final String title;
  final String? description;

  /// "yyyy-MM-dd"; [endDate] equals [startDate] for one-day items.
  final String startDate;
  final String endDate;

  /// "HH:mm" or null.
  final String? startTime;
  final String? endTime;
  final String? venue;

  const CalendarItem({
    required this.id,
    required this.type,
    required this.title,
    this.description,
    required this.startDate,
    required this.endDate,
    this.startTime,
    this.endTime,
    this.venue,
  });

  factory CalendarItem.fromJson(Map<String, dynamic> json) {
    final start = json['startDate'] as String;
    return CalendarItem(
      id: json['id'] as String,
      type: CalendarItemType.parse(json['type'] as String?),
      title: json['title'] as String,
      description: json['description'] as String?,
      startDate: start,
      endDate: (json['endDate'] as String?) ?? start,
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      venue: json['venue'] as String?,
    );
  }

  /// True when the item covers the "yyyy-MM-dd" [key] (ISO dates compare as strings).
  bool coversDay(String key) => startDate.compareTo(key) <= 0 && endDate.compareTo(key) >= 0;

  bool get isMultiDay => endDate != startDate;
}

/// A month's items indexed by day, so the grid and the day list share one lookup.
class CalendarMonth {
  final List<CalendarItem> items;

  const CalendarMonth(this.items);

  List<CalendarItem> forDay(DateTime day) {
    final key = dateKey(day);
    return [
      for (final i in items)
        if (i.coversDay(key)) i
    ];
  }

  Set<CalendarItemType> typesOn(DateTime day) => {for (final i in forDay(day)) i.type};
}
