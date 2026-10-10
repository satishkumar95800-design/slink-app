import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../l10n/language_controller.dart';

/// Brand palette — shared with the web landing page (cream + coral + deep teal).
class AppColors {
  static const cream = Color(0xFFFBF3EA);
  static const coral = Color(0xFFE8623D);
  static const coralDark = Color(0xFFC94F2E);
  static const teal = Color(0xFF123E3B);
  static const tealLight = Color(0xFF1B4B4A);
}

class AppThemeData {
  final ThemeData lightTheme;
  final ThemeData darkTheme;

  const AppThemeData({required this.lightTheme, required this.darkTheme});
}

/// The app uses the platform font (no custom font), so Kannada and Devanagari use
/// the OS's own fallbacks (Noto on Android, Kannada Sangam / Kohinoor on iOS) —
/// no fontFamilyFallback needed; setting one also replaced the Latin UI font on iOS.
///
/// Kannada and Devanagari vowel signs sit above and below the line; a 1.5 line
/// height keeps them from being clipped.
TextTheme _withLineHeight(TextTheme t, double h) => TextTheme(
      displayLarge: t.displayLarge?.copyWith(height: h),
      displayMedium: t.displayMedium?.copyWith(height: h),
      displaySmall: t.displaySmall?.copyWith(height: h),
      headlineLarge: t.headlineLarge?.copyWith(height: h),
      headlineMedium: t.headlineMedium?.copyWith(height: h),
      headlineSmall: t.headlineSmall?.copyWith(height: h),
      titleLarge: t.titleLarge?.copyWith(height: h),
      titleMedium: t.titleMedium?.copyWith(height: h),
      titleSmall: t.titleSmall?.copyWith(height: h),
      bodyLarge: t.bodyLarge?.copyWith(height: h),
      bodyMedium: t.bodyMedium?.copyWith(height: h),
      bodySmall: t.bodySmall?.copyWith(height: h),
      labelLarge: t.labelLarge?.copyWith(height: h),
      labelMedium: t.labelMedium?.copyWith(height: h),
      labelSmall: t.labelSmall?.copyWith(height: h),
    );

ThemeData _build(Brightness brightness, {required bool indicScript}) {
  final dark = brightness == Brightness.dark;

  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.teal,
    brightness: brightness,
  ).copyWith(
    primary: dark ? const Color(0xFFFF8A68) : AppColors.coral,
    onPrimary: Colors.white,
    secondary: dark ? const Color(0xFF7FB8B3) : AppColors.teal,
    onSecondary: dark ? AppColors.teal : Colors.white,
    surface: dark ? const Color(0xFF0E2B29) : Colors.white,
    surfaceContainerLowest: dark ? const Color(0xFF0A2120) : AppColors.cream,
  );

  final scaffoldBg = dark ? const Color(0xFF0A2120) : AppColors.cream;
  final onSurface = dark ? Colors.white : const Color(0xFF111827);
  final pill = RoundedRectangleBorder(borderRadius: BorderRadius.circular(999));

  OutlineInputBorder inputBorder(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: c, width: w),
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scaffoldBg,
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xFF0E2B29) : AppColors.teal,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
        color: Colors.white,
      ),
    ),
    textTheme: () {
      final base = ThemeData(brightness: brightness).textTheme.apply(
            bodyColor: onSurface,
            displayColor: onSurface,
          );
      return indicScript ? _withLineHeight(base, 1.5) : base;
    }(),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: scheme.primary,
        foregroundColor: Colors.white,
        shape: pill,
        minimumSize: const Size(64, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: scheme.primary,
        foregroundColor: Colors.white,
        shape: pill,
        minimumSize: const Size(64, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: dark ? Colors.white : AppColors.teal,
        side: BorderSide(color: dark ? Colors.white70 : AppColors.teal, width: 1.5),
        shape: pill,
        minimumSize: const Size(64, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: dark ? const Color(0xFF7FB8B3) : AppColors.teal,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: scheme.primary,
      foregroundColor: Colors.white,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF0E2B29) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: inputBorder(dark ? Colors.white24 : const Color(0xFFD1D5DB)),
      enabledBorder: inputBorder(dark ? Colors.white24 : const Color(0xFFD1D5DB)),
      focusedBorder: inputBorder(scheme.primary, 2),
      errorBorder: inputBorder(const Color(0xFFDC2626)),
      focusedErrorBorder: inputBorder(const Color(0xFFDC2626), 2),
    ),
    cardTheme: CardThemeData(
      color: dark ? const Color(0xFF0E2B29) : Colors.white,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: dark ? Colors.white12 : const Color(0xFFF3F4F6)),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: pill,
      side: BorderSide.none,
      backgroundColor: AppColors.teal.withValues(alpha: 0.08),
      labelStyle: TextStyle(
        fontWeight: FontWeight.w700,
        color: dark ? Colors.white : AppColors.teal,
      ),
    ),
    listTileTheme: const ListTileThemeData(
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 2),
    ),
    dividerTheme: DividerThemeData(color: dark ? Colors.white12 : const Color(0x14000000)),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? const Color(0xFF0E2B29) : Colors.white,
      indicatorColor: AppColors.coral.withValues(alpha: 0.15),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
      ),
    ),
    tabBarTheme: const TabBarThemeData(
      labelColor: Colors.white,
      unselectedLabelColor: Colors.white70,
      indicatorColor: AppColors.coral,
      labelStyle: TextStyle(fontWeight: FontWeight.w700),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: dark ? const Color(0xFF0E2B29) : AppColors.cream,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: dark ? const Color(0xFF0E2B29) : AppColors.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: AppColors.teal,
      contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
  );
}

final appThemeProvider = Provider<AppThemeData>((ref) {
  final indicScript = ref.watch(languageControllerProvider).languageCode != 'en';
  return AppThemeData(
    lightTheme: _build(Brightness.light, indicScript: indicScript),
    darkTheme: _build(Brightness.dark, indicScript: indicScript),
  );
});
