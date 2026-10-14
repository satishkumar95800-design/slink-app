import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Light or dark, chosen in Profile. Saved on this phone; survives logout.
const _themeModeKey = 'theme_mode';

/// The app opens in light theme unless the user switched to dark. The phone's
/// system setting is deliberately not followed.
class ThemeModeController extends StateNotifier<ThemeMode> {
  ThemeModeController(super.initial);

  /// Read once in main() before the first frame, so a dark user never sees a light flash.
  static Future<ThemeMode> loadInitial() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getString(_themeModeKey) == 'dark') return ThemeMode.dark;
    } catch (_) {}
    return ThemeMode.light;
  }

  void setDark(bool dark) {
    state = dark ? ThemeMode.dark : ThemeMode.light;
    SharedPreferences.getInstance()
        .then((p) => p.setString(_themeModeKey, dark ? 'dark' : 'light'))
        .ignore();
  }
}

/// Overridden in main() with the theme saved on this phone.
final initialThemeModeProvider = Provider<ThemeMode>((_) => ThemeMode.light);

final themeModeProvider = StateNotifierProvider<ThemeModeController, ThemeMode>((ref) {
  return ThemeModeController(ref.read(initialThemeModeProvider));
});
