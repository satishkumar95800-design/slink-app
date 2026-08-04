import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AppThemeData {
  final ThemeData lightTheme;
  final ThemeData darkTheme;

  const AppThemeData({required this.lightTheme, required this.darkTheme});
}

final appThemeProvider = Provider<AppThemeData>((ref) {
  // Colors are overridden at runtime from the tenant branding config
  const primaryColor = Color(0xFF1E40AF);
  const accentColor = Color(0xFFF59E0B);

  return AppThemeData(
    lightTheme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        secondary: accentColor,
        brightness: Brightness.light,
      ),
      useMaterial3: true,
    ),
    darkTheme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        secondary: accentColor,
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    ),
  );
});
