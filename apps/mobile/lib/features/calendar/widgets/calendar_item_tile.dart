import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/ui_kit.dart';
import '../calendar_models.dart';

/// One holiday / event / PTM in the selected day's list.
class CalendarItemTile extends StatelessWidget {
  final CalendarItem item;

  const CalendarItemTile({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd/MM/yyyy', 'en');
    final lines = <String>[
      if (item.isMultiDay) '${fmt.format(parseDateKey(item.startDate))} – ${fmt.format(parseDateKey(item.endDate))}',
      if (item.startTime != null) item.endTime != null ? '${item.startTime} – ${item.endTime}' : item.startTime!,
      if (item.venue != null) item.venue!,
      if (item.description != null) item.description!,
    ];
    return ListCard(
      leading: IconBadge(icon: item.type.icon, color: item.type.color),
      title: item.title,
      subtitle: lines.join('\n'),
      subtitleLines: 6,
      trailing: StatusPill(label: item.type.label(context), color: item.type.color),
    );
  }
}
