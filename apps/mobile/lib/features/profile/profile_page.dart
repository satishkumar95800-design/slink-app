import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/active_user.dart';
import '../../shared/services/branding_repository.dart';
import '../../shared/widgets/authenticated_scaffold.dart';
import '../auth/session_controller.dart';
import '../../core/l10n/l10n.dart';
import '../../core/l10n/language_controller.dart';
import '../../shared/widgets/language_picker.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionControllerProvider).user;
    final schoolName = ref.watch(brandingProvider).valueOrNull?.name;
    final locale = ref.watch(languageControllerProvider);
    final l = context.l10n;

    if (user == null) {
      return Scaffold(
        body: Center(child: Text(l.profileNoUser)),
      );
    }

    return AuthenticatedScaffold(
      appBar: AppBar(title: Text(l.profileTitle)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: CircleAvatar(
                  radius: 40,
                  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                  child: Text(
                    user.name.isNotEmpty ? user.name.substring(0, 1).toUpperCase() : '?',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(user.name, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.secondaryContainer,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _roleLabel(l, user.role),
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              const SizedBox(height: 24),
              if (schoolName != null) _InfoRow(label: l.profileSchool, value: schoolName),
              const SizedBox(height: 8),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.language),
                title: Text(l.languageTitle),
                subtitle: Text(languageNativeName(locale)),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => showLanguagePicker(context, ref, signedIn: true),
              ),
              const Spacer(),
              const Divider(height: 32),
              ListTile(
                leading: const Icon(Icons.logout),
                title: Text(l.profileLogout),
                onTap: () async {
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
                },
              ),
            ],
          ),
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
      };
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      ],
    );
  }
}
