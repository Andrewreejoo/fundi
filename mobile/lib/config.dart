/// Build-time settings. Pass with --dart-define, e.g.
///   flutter run --dart-define=API_URL=http://10.0.2.2:3000
/// (10.0.2.2 is the host machine from the Android emulator.)
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000');
}
