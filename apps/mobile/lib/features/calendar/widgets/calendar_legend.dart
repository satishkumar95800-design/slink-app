import 'package:flutter/material.dart';
import '../calendar_models.dart';

class CalendarLegend extends StatelessWidget {
  const CalendarLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        for (final t in CalendarItemType.values)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(radius: 7, backgroundColor: t.color),
              const SizedBox(width: 6),
              Text(t.label(context)),
            ],
          ),
      ],
    );
  }
}
