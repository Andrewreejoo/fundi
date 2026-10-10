# Fundi Android app (Flutter)

```bash
./tool/setup_android.sh      # once: generates android/ via `flutter create` and adds permissions
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Requires a recent Flutter stable (3.35 or newer; the app uses `RadioGroup` and `DropdownButtonFormField.initialValue`).

- `lib/api/` HTTP client (token refresh, secure storage), offline cache and action queue
- `lib/state/app_state.dart` language, user, location, catalog, fundi mode
- `lib/screens/` customer screens; `lib/screens/provider/` fundi sign-up, dashboard, services, ID verification
- `lib/l10n/strings.dart` Chichewa + English strings (draft Chichewa: get a native-speaker review)
- `assets/audio/` recorded Chichewa prompts for the Listen buttons

The `android/` folder is generated, not committed; `tool/setup_android.sh` recreates it identically on any machine and in CI.
