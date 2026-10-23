import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/active_user.dart';
import '../../shared/services/branding_repository.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_mode_controller.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../../shared/widgets/ui_kit.dart';
import '../auth/session_controller.dart';
import '../../core/l10n/l10n.dart';
import '../../core/l10n/language_controller.dart';
import '../../shared/widgets/language_picker.dart';
import 'class_reminder.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).user;
    final schoolName = ref.watch(brandingProvider).valueOrNull?.name;
    final locale = ref.watch(languageControllerProvider);
    final isDark = ref.watch(themeModeProvider) == ThemeMode.dark;
    final l = context.l10n;

    if (user == null) {
      return Scaffold(
        body: Center(child: Text(l.profileNoUser)),
      );
    }

    final theme = Theme.of(context);
    Future<void> confirmLogout() async {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          content: Text(l.profileLogoutConfirm),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: Text(l.commonCancel)),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: Text(l.profileLogout)),
          ],
        ),
      );
      if (ok == true) await ref.read(sessionControllerProvider.notifier).logout();
    }

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.profileTitle)),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
          children: [
            SoftCard(
              padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 18),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.coral.withValues(alpha: 0.35), width: 3),
                    ),
                    child: InitialAvatar(name: user.name, radius: 42),
                  ),
                  const SizedBox(height: 16),
                  Text(user.name,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  StatusPill(label: _roleLabel(l, user.role), color: FeatureColors.classes, icon: Icons.badge_rounded),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (schoolName != null)
              ListCard(
                leading: const IconBadge(icon: Icons.school_rounded, color: FeatureColors.timetable),
                title: schoolName,
                subtitle: l.profileSchool,
              ),
            ListCard(
              leading: const IconBadge(icon: Icons.translate_rounded, color: FeatureColors.reports),
              title: l.languageTitle,
              subtitle: languageNativeName(locale),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => showLanguagePicker(context, ref, signedIn: true),
            ),
            ListCard(
              leading: IconBadge(
                icon: isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                color: FeatureColors.notes,
              ),
              title: l.profileDarkTheme,
              trailing: Switch(
                value: isDark,
                onChanged: (v) => ref.read(themeModeProvider.notifier).setDark(v),
              ),
              onTap: () => ref.read(themeModeProvider.notifier).setDark(!isDark),
            ),
            if (user.role == UserRole.teacher && ref.watch(timetableEnabledProvider))
              const ClassReminderTile(),
            const SizedBox(height: 12),
            ListCard(
              leading: const IconBadge(icon: Icons.logout_rounded, color: Color(0xFFDC2626)),
              title: l.profileLogout,
              onTap: confirmLogout,
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(AppLocalizations l, UserRole role) => switch (role) {
        UserRole.parent => l.roleParent,
        UserRole.teacher => l.roleTeacher,
        UserRole.admin => l.roleAdmin,
        UserRole.accounts => l.roleAccounts,
        UserRole.superAdmin => l.roleSuperAdmin,
        UserRole.driver => l.roleDriver,
        UserRole.librarian => l.roleLibrarian,
        UserRole.receptionist => l.roleReceptionist,
      };
}
