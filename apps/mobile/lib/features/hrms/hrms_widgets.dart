import 'package:flutter/material.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/ui_kit.dart';
import 'hrms_repository.dart';

/// Error body for HR screens: a friendly empty state when the login has no
/// employee record, otherwise a retry.
class HrmsError extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;

  const HrmsError({super.key, required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (isNoEmployeeRecord(error)) {
      return EmptyState(icon: Icons.badge_outlined, message: l.hrmsNoRecord, color: FeatureColors.sent);
    }
    return EmptyState(
      icon: Icons.cloud_off_rounded,
      message: l.hrmsCouldNotLoad,
      color: FeatureColors.sent,
      actionLabel: l.commonRetry,
      onAction: onRetry,
    );
  }
}
