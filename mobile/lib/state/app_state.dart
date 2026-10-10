import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../api/offline.dart';
import '../l10n/strings.dart';

/// Where the user is searching from: a named place (no GPS needed) or a GPS point.
class SavedLocation {
  SavedLocation({this.placeId, this.lat, this.lng, required this.label});
  final int? placeId;
  final double? lat;
  final double? lng;
  final String label;

  Map<String, dynamic> toJson() => {'placeId': placeId, 'lat': lat, 'lng': lng, 'label': label};
  static SavedLocation fromJson(Map<String, dynamic> j) => SavedLocation(
        placeId: j['placeId'] as int?,
        lat: (j['lat'] as num?)?.toDouble(),
        lng: (j['lng'] as num?)?.toDouble(),
        label: j['label'] as String? ?? '',
      );

  /// Query string fragment for /providers/search and booking bodies.
  Map<String, String> get query =>
      placeId != null ? {'placeId': '$placeId'} : {'lat': '$lat', 'lng': '$lng'};
  Map<String, dynamic> get body => placeId != null ? {'placeId': placeId} : {'lat': lat, 'lng': lng};
}

class AppState extends ChangeNotifier {
  AppState(this.api);
  final Api api;
  final queue = OfflineQueue();

  bool ready = false;
  bool languageChosen = false;
  Lang lang = Lang.ny;
  Map<String, dynamic>? user;
  List<Map<String, dynamic>> categories = [];
  List<Map<String, dynamic>> places = [];
  Map<String, dynamic> settings = {};
  SavedLocation? location;
  bool providerMode = false;
  bool offline = false;
  Timer? _flushTimer;

  bool get signedIn => user != null;
  bool get isProvider => (user?['roles'] as List?)?.contains('provider') ?? false;
  String t(String key) => tr(lang, key);

  String catName(Map c) {
    final ny = (c['name_ny'] ?? c['category_name_ny']) as String?;
    final en = (c['name_en'] ?? c['category_name_en']) as String? ?? '';
    return lang == Lang.ny ? (ny ?? en) : en;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    languageChosen = prefs.getString('lang') != null;
    lang = prefs.getString('lang') == 'en' ? Lang.en : Lang.ny;
    providerMode = prefs.getBool('providerMode') ?? false;
    final loc = prefs.getString('location');
    if (loc != null) location = SavedLocation.fromJson(jsonDecode(loc) as Map<String, dynamic>);

    await api.loadTokens();
    await Future.wait([loadCatalog(), if (api.signedIn) refreshMe()]);
    if (!isProvider) providerMode = false;
    ready = true;
    notifyListeners();
    await flushQueue();
    _flushTimer = Timer.periodic(const Duration(seconds: 45), (_) => flushQueue());
  }

  @override
  void dispose() {
    _flushTimer?.cancel();
    super.dispose();
  }

  Future<void> loadCatalog() async {
    try {
      final results = await Future.wait([
        api.get('/categories', cacheable: true),
        api.get('/places', cacheable: true),
        api.get('/config', cacheable: true),
      ]);
      categories = List<Map<String, dynamic>>.from(results[0] as List);
      places = List<Map<String, dynamic>>.from(results[1] as List);
      settings = Map<String, dynamic>.from(results[2] as Map);
      offline = false;
    } on ApiException catch (e) {
      offline = e.isOffline;
    }
    notifyListeners();
  }

  Future<void> refreshMe() async {
    try {
      user = Map<String, dynamic>.from(await api.get('/me', cacheable: true) as Map);
      if (user?['language'] != null && !languageChosen) {
        lang = user!['language'] == 'en' ? Lang.en : Lang.ny;
      }
    } on ApiException catch (e) {
      if (e.status == 401) {
        user = null;
        await api.clearTokens();
      }
    }
    notifyListeners();
  }

  Future<void> setLang(Lang l) async {
    lang = l;
    languageChosen = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('lang', l == Lang.en ? 'en' : 'ny');
    notifyListeners();
    if (signedIn) unawaited(api.patch('/me', {'language': l == Lang.en ? 'en' : 'ny'}).catchError((_) => null));
  }

  Future<void> setLocation(SavedLocation l) async {
    location = l;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('location', jsonEncode(l.toJson()));
    notifyListeners();
  }

  Future<void> setProviderMode(bool v) async {
    providerMode = v && isProvider;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('providerMode', providerMode);
    notifyListeners();
  }

  Future<void> signedInWith(Map<String, dynamic> tokens) async {
    await api.saveTokens(tokens);
    user = Map<String, dynamic>.from(tokens['user'] as Map);
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await api.post('/auth/logout', {});
    } catch (_) {}
    await api.clearTokens();
    user = null;
    providerMode = false;
    notifyListeners();
  }

  /// Run a booking action. If the phone is offline and the action is safe to replay, queue it.
  Future<dynamic> act(String path, {Map<String, dynamic>? body, bool queueable = false, String label = ''}) async {
    try {
      final r = await api.post(path, body ?? {});
      offline = false;
      return r;
    } on ApiException catch (e) {
      if (e.isOffline && queueable) {
        await queue.add(QueuedAction(path, body ?? {}, label));
        offline = true;
        notifyListeners();
        return null;
      }
      rethrow;
    }
  }

  Future<void> flushQueue() async {
    final sent = await queue.flush((p, b) => api.post(p, b), (e) => e is ApiException && e.isOffline);
    if (sent > 0) {
      offline = false;
      notifyListeners();
    }
  }
}
