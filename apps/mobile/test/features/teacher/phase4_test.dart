import 'package:flutter_test/flutter_test.dart';
import 'package:slink/features/dashboard/today_strip.dart';
import 'package:slink/features/notices/notice_detail_page.dart';
import 'package:slink/shared/services/broadcast_repository.dart';

TodayPeriod p(int n, String start, String end, String cls) =>
    TodayPeriod(periodNumber: n, startTime: start, endTime: end, classLabel: cls, subject: 'Maths');

void main() {
  group('currentAndNext', () {
    final day = [p(1, '09:00', '09:45', '1A'), p(3, '10:30', '11:15', '3B'), p(4, '11:15', '12:00', '5A')];

    test('during a period: now + next', () {
      final r = currentAndNext(day, '10:45');
      expect(r.now?.classLabel, '3B');
      expect(r.next?.classLabel, '5A');
    });

    test('in a gap: only next', () {
      final r = currentAndNext(day, '10:00');
      expect(r.now, isNull);
      expect(r.next?.classLabel, '3B');
    });

    test('a period ends exactly when the next starts', () {
      final r = currentAndNext(day, '11:15');
      expect(r.now?.classLabel, '5A');
      expect(r.next, isNull);
    });

    test('after the last period: nothing', () {
      final r = currentAndNext(day, '12:30');
      expect(r.now, isNull);
      expect(r.next, isNull);
    });
  });

  test('sent items parse seen counts', () {
    final item = SentItem.fromJson({
      'id': 'b1',
      'kind': 'homework',
      'title': 'Homework',
      'body': 'Chapter 4',
      'createdAt': '2026-10-09T05:00:00.000Z',
      'class': {'id': 'c1', 'name': 'Class 3', 'section': 'B'},
      'subject': 'Maths',
      'attachmentCount': 2,
      'recipients': 35,
      'seen': 28,
    });
    expect(item.kind, BroadcastKind.homework);
    expect(item.classLabel, 'Class 3 B');
    expect((item.seen, item.recipients), (28, 35));
  });

  test('attachments: PDFs are recognised from list items and from signed push URLs', () {
    expect(NoticeAttachment.fromAny({'url': 'https://x/a', 'contentType': 'application/pdf'}).isPdf, isTrue);
    expect(NoticeAttachment.fromAny('https://bucket.s3.amazonaws.com/t/attachments/circular.pdf?X-Amz-Expires=86400').isPdf, isTrue);
    expect(NoticeAttachment.fromAny('https://bucket.s3.amazonaws.com/t/attachments/photo.jpg?sig=1').isPdf, isFalse);
  });
}
