import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/calendar/calendar_models.dart';

void main() {
  CalendarItem item(Map<String, dynamic> j) => CalendarItem.fromJson({'id': 'x', 'title': 't', ...j});

  test('parses types and defaults endDate to startDate', () {
    final i = item({'type': 'PTM', 'startDate': '2026-11-20'});
    expect(i.type, CalendarItemType.ptm);
    expect(i.endDate, '2026-11-20');
    expect(i.isMultiDay, isFalse);
  });

  test('multi-day items cover every day in range, one-day items only theirs', () {
    final month = CalendarMonth([
      item({'type': 'EVENT', 'startDate': '2026-11-10', 'endDate': '2026-11-12'}),
      item({'type': 'HOLIDAY', 'startDate': '2026-11-11', 'endDate': '2026-11-11'}),
    ]);
    expect(month.forDay(DateTime(2026, 11, 9)), isEmpty);
    expect(month.typesOn(DateTime(2026, 11, 11)), {CalendarItemType.event, CalendarItemType.holiday});
    expect(month.typesOn(DateTime(2026, 11, 12)), {CalendarItemType.event});
    expect(month.forDay(DateTime(2026, 11, 13)), isEmpty);
  });

  test('dateKey uses zero-padded Latin digits', () {
    expect(dateKey(DateTime(2026, 3, 5)), '2026-03-05');
    expect(parseDateKey('2026-03-05'), DateTime(2026, 3, 5));
  });
}
