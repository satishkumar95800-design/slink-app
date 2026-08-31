import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/services/secure_storage_service.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';

/// First-launch screen — the school gives parents a short code at onboarding
/// (see product spec §4a "school-specific code, QR code, or invite link").
/// This captures that code once; it's then persisted and reused on every
/// subsequent app open, so parents only see this screen the first time.
class TenantEntryPage extends ConsumerStatefulWidget {
  const TenantEntryPage({super.key});

  @override
  ConsumerState<TenantEntryPage> createState() => _TenantEntryPageState();
}

class _TenantEntryPageState extends ConsumerState<TenantEntryPage> {
  final _controller = TextEditingController();
  bool _isSaving = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _controller.text.trim().toLowerCase();
    if (code.isEmpty) {
      setState(() => _error = 'Enter your school code to continue.');
      return;
    }

    setState(() {
      _isSaving = true;
      _error = null;
    });

    await ref.read(secureStorageServiceProvider).writeTenantId(code);

    if (mounted) context.go('/login/phone');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('School Connect', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                'Enter the school code your school gave you to get started.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              if (_error != null) ErrorBanner(message: _error!),
              TextField(
                controller: _controller,
                autocorrect: false,
                textCapitalization: TextCapitalization.none,
                decoration: const InputDecoration(
                  labelText: 'School code',
                  hintText: 'e.g. greenfield-school',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              PrimaryButton(label: 'Continue', isLoading: _isSaving, onPressed: _submit),
            ],
          ),
        ),
      ),
    );
  }
}
