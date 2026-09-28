import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/services/notifications_repository.dart';

final notificationHistoryProvider = FutureProvider.autoDispose<List<NotificationHistoryItem>>((ref) async {
  return ref.watch(notificationsRepositoryProvider).fetchMine();
});
