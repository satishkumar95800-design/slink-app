import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/strings.dart';
import '../../shared/services/api_client.dart';

class TodayPeriod {
  final int periodNumber;
  final String? startTime;
  final String? endTime;
  final String classLabel;
  final String subject;

  const TodayPeriod({
    required this.periodNumber,
    this.startTime,
    this.endTime,
    required this.classLabel,
    required this.subject,
  });

  factory TodayPeriod.fromJson(Map<String, dynamic> json) {
    final cls = json['class'] as Map<String, dynamic>;
    final section = cls['section'] as String?;
    return TodayPeriod(
      periodNumber: json['periodNumber'] as int,
      startTime: json['startTime'] as String?,
      endTime: json['endTime'] as String?,
      classLabel: [cls['name'] as String, if (section != null && section.isNotEmpty) section].join(' '),
      subject: json['subject'] as String,
    );
  }
}

class TeacherToday {
  final bool offDay;
  final bool timingsConfigured;
  final List<TodayPeriod> periods;

  const TeacherToday({required this.offDay, required this.timingsConfigured, required this.periods});

  factory TeacherToday.fromJson(Map<String, dynamic> json) => TeacherToday(
        offDay: json['offDay'] as bool,
        timingsConfigured: json['timingsConfigured'] as bool,
        periods: (json['periods'] as List<dynamic>).map((e) => TodayPeriod.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

final teacherTodayProvider = FutureProvider.autoDispose<TeacherToday>((ref) async {
  final Dio dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/teacher-dashboard/today');
  return TeacherToday.fromJson(response.data!);
});

/// Which period is on now and which is next, for "HH:MM" [now]. Pure, so it's unit-tested.
({TodayPeriod? now, TodayPeriod? next}) currentAndNext(List<TodayPeriod> periods, String now) {
  final timed = periods.where((p) => p.startTime != null && p.endTime != null).toList()
    ..sort((a, b) => a.startTime!.compareTo(b.startTime!));
  TodayPeriod? current;
  TodayPeriod? next;
  for (final p in timed) {
    if (p.startTime!.compareTo(now) <= 0 && now.compareTo(p.endTime!) < 0) {
      current = p;
    } else if (p.startTime!.compareTo(now) > 0) {
      next = p;
      break;
    }
  }
  return (now: current, next: next);
}

/// Teacher dashboard "Today" strip (§4.1): "Now: Class 3B · Maths (10:30–11:15)" /
/// "Next: Class 5A · Science (11:15)". Hidden on Sundays and school holidays.
class TodayStrip extends ConsumerStatefulWidget {
  const TodayStrip({super.key});

  @override
  ConsumerState<TodayStrip> createState() => _TodayStripState();
}

class _TodayStripState extends ConsumerState<TodayStrip> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // Re-evaluate Now/Next every minute; the schedule itself is fetched once.
    _tick = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final today = ref.watch(teacherTodayProvider).valueOrNull;
    if (today == null || today.offDay) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final lines = <Widget>[];
    if (today.periods.isEmpty) {
      lines.add(Text(AppStrings.noPeriodsToday, style: theme.textTheme.titleSmall));
    } else if (!today.timingsConfigured) {
      // No bell schedule yet: list today's periods in order.
      lines.add(Text(
        today.periods.map((p) => AppStrings.periodLabel(p.periodNumber, p.classLabel, p.subject)).join('\n'),
        style: theme.textTheme.bodyMedium,
      ));
    } else {
      final t = TimeOfDay.now();
      final now = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
      final slot = currentAndNext(today.periods, now);
      final current = slot.now;
      final next = slot.next;
      if (current != null) {
        lines.add(Text(
          AppStrings.nowPeriod(current.classLabel, current.subject, '${current.startTime}–${current.endTime}'),
          style: theme.textTheme.titleMedium,
        ));
      }
      if (next != null) {
        lines.add(Text(AppStrings.nextPeriod(next.classLabel, next.subject, next.startTime), style: theme.textTheme.bodyMedium));
      }
      if (current == null && next == null) {
        lines.add(Text(AppStrings.noMorePeriods, style: theme.textTheme.titleSmall));
      }
    }

    return Card(
      color: theme.colorScheme.secondaryContainer,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.schedule),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: lines)),
          ],
        ),
      ),
    );
  }
}
