import 'package:flutter/material.dart';

/// Colours from the wireframes. Large type and 48dp+ targets for low-literacy, low-vision users.
class FundiColors {
  static const ground = Color(0xFFFBF8F2);
  static const surface = Colors.white;
  static const sunk = Color(0xFFF2EDE3);
  static const ink = Color(0xFF1C1917);
  static const muted = Color(0xFF57534E);
  static const line = Color(0xFFE7E1D6);
  static const green = Color(0xFF0F5132);
  static const greenTint = Color(0xFFE3EFE7);
  static const orange = Color(0xFFB4470F);
  static const orangeTint = Color(0xFFFBE6DA);
  static const gold = Color(0xFF6E4D00);
  static const goldTint = Color(0xFFFBEFD0);
  static const red = Color(0xFFA42A1C);
  static const redTint = Color(0xFFFBE3DF);
}

ThemeData fundiTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: FundiColors.green, primary: FundiColors.green, surface: FundiColors.surface),
    scaffoldBackgroundColor: FundiColors.ground,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: FundiColors.ink, displayColor: FundiColors.ink).copyWith(
          bodyMedium: base.textTheme.bodyMedium?.copyWith(fontSize: 16, color: FundiColors.ink),
          bodyLarge: base.textTheme.bodyLarge?.copyWith(fontSize: 17, color: FundiColors.ink),
        ),
    appBarTheme: const AppBarTheme(
      backgroundColor: FundiColors.surface,
      foregroundColor: FundiColors.ink,
      elevation: 0,
      scrolledUnderElevation: 1,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: FundiColors.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 54),
        backgroundColor: FundiColors.green,
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 50),
        foregroundColor: FundiColors.green,
        side: const BorderSide(color: FundiColors.green, width: 1.5),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FundiColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: FundiColors.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFD6CFC2), width: 1.5)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: FundiColors.green, width: 2)),
    ),
    cardTheme: CardThemeData(
      color: FundiColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: FundiColors.line)),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: FundiColors.surface,
      indicatorColor: FundiColors.greenTint,
      height: 72,
    ),
  );
}
