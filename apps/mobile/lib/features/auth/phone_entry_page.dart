import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/l10n/l10n.dart';
import '../../shared/widgets/error_banner.dart';
import '../../shared/widgets/auth_shell.dart';
import '../../shared/widgets/primary_button.dart';
import 'country_codes.dart';
import 'phone_auth_controller.dart';

const _countryKey = 'login_country';

class PhoneEntryPage extends ConsumerStatefulWidget {
  const PhoneEntryPage({super.key});

  @override
  ConsumerState<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends ConsumerState<PhoneEntryPage> {
  final _controller = TextEditingController();
  String? _localError;
  CountryCode _country = india;

  @override
  void initState() {
    super.initState();
    // The last country used on this phone (most families never change it).
    SharedPreferences.getInstance().then((p) {
      final saved = countryByIso(p.getString(_countryKey));
      if (mounted && saved != _country) setState(() => _country = saved);
    }).catchError((_) {});
  }

  Future<void> _pickCountry() async {
    final picked = await showModalBottomSheet<CountryCode>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CountryPicker(selected: _country),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _country = picked;
      _localError = null;
    });
    SharedPreferences.getInstance().then((p) => p.setString(_countryKey, picked.iso)).ignore();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Spaces and dashes are fine; a leading 0 (trunk prefix) is dropped.
    final digits = _controller.text.replaceAll(RegExp(r'[\s-]'), '').replaceFirst(RegExp(r'^0+'), '');
    // The country code plus the local number is the E.164 format the backend
    // stores (CreateStudentDto/LinkParentDto), e.g. +919876543210.
    if (!_country.isValidLocal(digits)) {
      setState(() => _localError = _country == india ? context.l10n.authInvalidMobile : context.l10n.authInvalidMobileIntl);
      return;
    }
    setState(() => _localError = null);
    await ref.read(phoneAuthControllerProvider.notifier).sendOtp('+${_country.dial}$digits');
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

    return AuthShell(
      onBack: () => context.go('/onboarding/tenant'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l.authEnterMobile, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(l.authOtpExplainer, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 24),
          if (_localError != null) ErrorBanner(message: _localError!),
          if (_localError == null && authState.error != null) ErrorBanner(message: authState.error!),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.phone,
            // Room for a leading 0 or spaces, which are stripped on submit.
            maxLength: _country.maxDigits + 3,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: 1),
            decoration: InputDecoration(
              labelText: l.authMobileLabel,
              prefixIcon: Semantics(
                button: true,
                label: l.authCountryCode,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: _pickCountry,
                  child: Padding(
                    padding: const EdgeInsetsDirectional.only(start: 12, end: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_country.flag, style: const TextStyle(fontSize: 20)),
                        const SizedBox(width: 6),
                        Text('+${_country.dial}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        const Icon(Icons.arrow_drop_down_rounded),
                      ],
                    ),
                  ),
                ),
              ),
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
    );
  }
}

/// Searchable list of calling codes.
class _CountryPicker extends StatefulWidget {
  final CountryCode selected;

  const _CountryPicker({required this.selected});

  @override
  State<_CountryPicker> createState() => _CountryPickerState();
}

class _CountryPickerState extends State<_CountryPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final shown = countryCodes.where((c) => c.matches(_query)).toList();
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                autofocus: false,
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                  hintText: l.authSearchCountry,
                  prefixIcon: const Icon(Icons.search_rounded),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: shown.length,
                itemBuilder: (context, i) {
                  final c = shown[i];
                  final selected = c == widget.selected;
                  return ListTile(
                    leading: Text(c.flag, style: const TextStyle(fontSize: 24)),
                    title: Text(c.name),
                    trailing: Text(
                      '+${c.dial}',
                      style: TextStyle(fontWeight: FontWeight.w700, color: selected ? Theme.of(context).colorScheme.primary : null),
                    ),
                    selected: selected,
                    onTap: () => Navigator.of(context).pop(c),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
