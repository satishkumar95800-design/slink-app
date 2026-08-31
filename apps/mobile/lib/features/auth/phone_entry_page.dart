import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/widgets/error_banner.dart';
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
      setState(() => _localError = 'Enter a valid 10-digit mobile number.');
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sign in'),
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
              Text('Enter your mobile number', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                "We'll send a one-time code to verify it's you.",
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              if (_localError != null) ErrorBanner(message: _localError!),
              if (_localError == null && authState.error != null) ErrorBanner(message: authState.error!),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                decoration: const InputDecoration(
                  labelText: 'Mobile number',
                  prefixText: '+91 ',
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Send code',
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
