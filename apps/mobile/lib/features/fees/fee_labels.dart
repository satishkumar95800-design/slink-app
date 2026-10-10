import '../../core/l10n/l10n.dart';
import '../../shared/models/student_fee.dart';

String feeStatusLabel(AppLocalizations l, FeeStatus status) => switch (status) {
      FeeStatus.paid => l.feeStatusPaid,
      FeeStatus.pending => l.feeStatusPending,
      FeeStatus.overdue => l.feeStatusOverdue,
      FeeStatus.partial => l.feeStatusPartial,
      FeeStatus.waived => l.feeStatusWaived,
    };

/// Payment method / claimed mode from the API ("bank_transfer", "gateway", …).
String paymentModeLabel(AppLocalizations l, String mode) => switch (mode) {
      'cash' => l.paymentModeCash,
      'cheque' => l.paymentModeCheque,
      'bank_transfer' => l.paymentModeBankTransfer,
      'upi' => l.paymentModeUpi,
      'demand_draft' => l.paymentModeDemandDraft,
      'gateway' => l.paymentModeOnline,
      _ => mode,
    };
