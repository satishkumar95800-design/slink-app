import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

ThemeData _build(Brightness brightness) {
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
    textTheme: ThemeData(brightness: brightness).textTheme.apply(
          bodyColor: onSurface,
          displayColor: onSurface,
        ),
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
  return AppThemeData(
    lightTheme: _build(Brightness.light),
    darkTheme: _build(Brightness.dark),
  );
});
