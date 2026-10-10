import '../../core/l10n/l10n.dart';
import '../../shared/models/report.dart';

String reportTypeLabel(AppLocalizations l, ReportType type) => switch (type) {
      ReportType.academic => l.reportTypeAcademic,
      ReportType.attendance => l.reportTypeAttendance,
      ReportType.behavior => l.reportTypeBehavior,
      ReportType.homework => l.reportTypeHomework,
      ReportType.reportCard => l.reportTypeReportCard,
    };

/// Same, from the API's raw value ("report_card", "academic", …).
String reportTypeLabelFromApi(AppLocalizations l, String raw) => switch (raw) {
      'academic' => l.reportTypeAcademic,
      'attendance' => l.reportTypeAttendance,
      'behavior' => l.reportTypeBehavior,
      'homework' => l.reportTypeHomework,
      'report_card' => l.reportTypeReportCard,
      _ => raw,
    };
