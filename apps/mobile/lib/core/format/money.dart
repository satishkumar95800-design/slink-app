import 'package:intl/intl.dart';

final _rupees = NumberFormat('#,##,##0', 'en_IN');
final _rupeesWithPaise = NumberFormat('#,##,##0.00', 'en_IN');

/// Indian digit grouping; paise only when non-zero.
/// 21400 -> "₹21,400", 125000.5 -> "₹1,25,000.50". Mirrors web-admin lib/format.ts.
String formatRupees(num? amount) {
  if (amount == null || !amount.isFinite) return '₹0';
  final rounded = (amount * 100).round() / 100;
  final hasPaise = rounded != rounded.truncateToDouble();
  return '₹${(hasPaise ? _rupeesWithPaise : _rupees).format(rounded)}';
}
