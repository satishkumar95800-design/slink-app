import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import '../auth/session_controller.dart';
import 'app_lock_controller.dart';

/// Sits above the router (MaterialApp.router builder): covers the app with the
/// lock screen while a signed-in session is locked, and shows the one-time
/// offer to switch biometric unlock on after an OTP sign-in.
class AppLockGate extends ConsumerStatefulWidget {
  const AppLockGate({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    final lock = ref.read(appLockProvider.notifier);
    if (s == AppLifecycleState.paused || s == AppLifecycleState.hidden) lock.wentToBackground();
    if (s == AppLifecycleState.resumed) lock.cameBack();
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(sessionControllerProvider.select((s) => s.status == SessionStatus.loggedIn));
    final lock = ref.watch(appLockProvider);
    return Stack(
      children: [
        // Hidden from screen readers too while covered.
        ExcludeSemantics(excluding: signedIn && lock.covers, child: widget.child),
        if (signedIn && lock.covers) Positioned.fill(child: LockScreen(checking: lock.checking && !lock.locked)),
        if (signedIn && !lock.covers && lock.offer)
          const Positioned(left: 0, right: 0, bottom: 0, child: _UnlockOffer()),
      ],
    );
  }
}

class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key, this.checking = false});

  /// Only reading the setting: show the brand, no prompt yet.
  final bool checking;

  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  bool _failed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    // Ask straight away; the button is there if they cancel.
    if (!widget.checking) WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  @override
  void didUpdateWidget(LockScreen old) {
    super.didUpdateWidget(old);
    if (old.checking && !widget.checking) WidgetsBinding.instance.addPostFrameCallback((_) => _unlock());
  }

  Future<void> _unlock() async {
    if (_busy || !mounted) return;
    setState(() => _busy = true);
    final ok = await ref.read(appLockProvider.notifier).unlock(context.l10n.appLockReason);
    if (mounted) {
      setState(() {
        _busy = false;
        _failed = !ok;
      });
    }
  }

  /// [navContext] is inside the lock screen's own navigator, which shows the dialog.
  Future<void> _useOtp(BuildContext navContext) async {
    final l = navContext.l10n;
    final ok = await showDialog<bool>(
      context: navContext,
            builder: (c) => AlertDialog(
        content: Text(l.appLockUseOtpConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: Text(l.commonCancel)),
          FilledButton(onPressed: () => Navigator.of(c).pop(true), child: Text(l.appLockUseOtp)),
        ],
      ),
    );
    if (ok == true) await ref.read(sessionControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      child: SafeArea(
        // A local navigator so the "use OTP" dialog can open above the lock
        // (this sits above the app's own navigator); it must not share the
        // app's HeroController.
        child: HeroControllerScope.none(
          child: Navigator(
            onGenerateRoute: (_) => MaterialPageRoute(
              builder: (context) => Material(
                color: theme.colorScheme.surface,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const Spacer(),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(20),
                        child: Image.asset('assets/icons/app_icon.png', width: 84, height: 84),
                      ),
                      const SizedBox(height: 20),
                      Text(l.appName, style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
                      if (!widget.checking) ...[
                        const SizedBox(height: 8),
                        Text(l.appLockLocked, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                      ],
                      const Spacer(),
                      if (!widget.checking) ...[
                        if (_failed)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(l.appLockFailed,
                                textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.error)),
                          ),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: _busy ? null : _unlock,
                            icon: const Icon(Icons.fingerprint_rounded),
                            label: Text(l.appLockUnlock),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(onPressed: () => _useOtp(context), child: Text(l.appLockUseOtp)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _UnlockOffer extends ConsumerWidget {
  const _UnlockOffer();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final theme = Theme.of(context);
    final lock = ref.read(appLockProvider.notifier);
    return SafeArea(
      top: false,
      child: Material(
        elevation: 12,
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.fingerprint_rounded, size: 32, color: AppColors.coral),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(l.appLockOfferTitle,
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(l.appLockOfferBody, style: theme.textTheme.bodyMedium),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => lock.setEnabled(true, l.appLockReason),
                child: Text(l.appLockOfferYes),
              ),
              TextButton(onPressed: lock.dismissOffer, child: Text(l.appLockOfferNo)),
            ],
          ),
        ),
      ),
    );
  }
}
