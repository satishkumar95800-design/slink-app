/// Prisma's Decimal fields (amountDue, amountPaid, totalAmount, amount, lateFeePerDay)
/// are serialized as JSON strings, not numbers — Decimal.prototype.toJSON returns a
/// string on the API side. Always parse money fields through this helper.
double parseDecimal(Object? value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.parse(value as String);
}

double? parseDecimalOrNull(Object? value) {
  if (value == null) return null;
  return parseDecimal(value);
}

DateTime? parseDateOrNull(Object? value) {
  if (value == null) return null;
  return DateTime.parse(value as String);
}
