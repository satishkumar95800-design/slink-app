import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/primary_button.dart';
import 'phone_auth_controller.dart';
import 'session_controller.dart';

class OtpVerifyPage extends ConsumerStatefulWidget {
  const OtpVerifyPage({super.key});

  @override
  ConsumerState<OtpVerifyPage> createState() => _OtpVerifyPageState();
}

class _OtpVerifyPageState extends ConsumerState<OtpVerifyPage> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final code = _controller.text.trim();
    if (code.length != 6) return;
    if (ref.read(phoneAuthControllerProvider).isLoading) return;
    ref.read(phoneAuthControllerProvider.notifier).verifyOtp(code);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionControllerProvider, (previous, next) {
      if (next.status == SessionStatus.loggedIn) {
        context.go('/dashboard');
      }
    });

    final authState = ref.watch(phoneAuthControllerProvider);
    final phoneNumber = authState.phoneNumber ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Verify code'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            ref.read(phoneAuthControllerProvider.notifier).reset();
            context.go('/login/phone');
          },
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Enter the 6-digit code', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('Sent to $phoneNumber', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 24),
              if (authState.error != null) ErrorBanner(message: authState.error!),
              TextField(
                controller: _controller,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: const InputDecoration(border: OutlineInputBorder(), counterText: ''),
                onChanged: (value) {
                  if (value.length == 6) _submit();
                },
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Verify',
                isLoading: authState.isLoading,
                onPressed: _submit,
              ),
              const SizedBox(height: 12),
              Center(
                child: TextButton(
                  onPressed: authState.isLoading
                      ? null
                      : () => ref.read(phoneAuthControllerProvider.notifier).sendOtp(phoneNumber),
                  child: const Text('Resend code'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
