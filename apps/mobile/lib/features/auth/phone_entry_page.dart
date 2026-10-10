import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/language_picker.dart';
import '../../shared/widgets/primary_button.dart';
import 'phone_auth_controller.dart';

class PhoneEntryPage extends ConsumerStatefulWidget {
  const PhoneEntryPage({super.key});

  @override
  ConsumerState<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends ConsumerState<PhoneEntryPage> {
  final _controller = TextEditingController();
  String? _localError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final digits = _controller.text.trim();
    // Expect a 10-digit local number; prefixed with +91 to match the E.164
    // format the backend validates against (CreateStudentDto/LinkParentDto).
    if (!RegExp(r'^\d{10}$').hasMatch(digits)) {
      setState(() => _localError = context.l10n.authInvalidMobile);
      return;
    }
    setState(() => _localError = null);
    await ref.read(phoneAuthControllerProvider.notifier).sendOtp('+91$digits');
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(phoneAuthControllerProvider, (previous, next) {
      if (next.step == PhoneAuthStep.enterOtp && previous?.step != PhoneAuthStep.enterOtp) {
        context.go('/login/otp');
      }
    });
    final authState = ref.watch(phoneAuthControllerProvider);
    final l = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l.authSignIn),
        actions: const [LanguageButton(color: Colors.white)],
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/onboarding/tenant'),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(l.authEnterMobile, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                l.authOtpExplainer,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              if (_localError != null) ErrorBanner(message: _localError!),
              if (_localError == null && authState.error != null) ErrorBanner(message: authState.error!),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: InputDecoration(
                  labelText: l.authMobileLabel,
                  prefixText: '+91 ',
                  border: const OutlineInputBorder(),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: l.authSendCode,
                isLoading: authState.isLoading,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
