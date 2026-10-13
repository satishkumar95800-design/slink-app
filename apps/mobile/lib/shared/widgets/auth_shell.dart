import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/l10n/l10n.dart';
import '../../core/theme/app_theme.dart';
import 'language_picker.dart';

/// Sign-in layout: teal top with the logo, name and tagline, and the form on a
/// cream sheet below. Scrolls as one piece so the keyboard never hides the field.
class AuthShell extends StatelessWidget {
  final Widget child;
  final VoidCallback? onBack;

  const AuthShell({super.key, required this.child, this.onBack});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final theme = Theme.of(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: theme.brightness == Brightness.dark ? AppColors.tealDeep : AppColors.teal,
        body: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SafeArea(
                      bottom: false,
                      child: Stack(
                        children: [
                          Positioned(
                            right: -40,
                            top: -30,
                            child: Container(
                              width: 160,
                              height: 160,
                              decoration: BoxDecoration(
                                color: AppColors.coral.withValues(alpha: 0.18),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(8, 4, 8, 28),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    if (onBack != null)
                                      IconButton(
                                        icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                                        tooltip: MaterialLocalizations.of(context).backButtonTooltip,
                                        onPressed: onBack,
                                      ),
                                    const Spacer(),
                                    const LanguageButton(color: Colors.white),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  width: 92,
                                  height: 92,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(28),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.18),
                                        blurRadius: 24,
                                        offset: const Offset(0, 10),
                                      ),
                                    ],
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: Image.asset('assets/icons/splash_logo.png', fit: BoxFit.cover),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  l.appName,
                                  style: theme.textTheme.headlineMedium
                                      ?.copyWith(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                                ),
                                const SizedBox(height: 6),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 32),
                                  child: Text(
                                    l.authTagline,
                                    textAlign: TextAlign.center,
                                    style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white70),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Container(
                        decoration: BoxDecoration(
                          color: theme.scaffoldBackgroundColor,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                        ),
                        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
                        child: SafeArea(top: false, child: child),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
