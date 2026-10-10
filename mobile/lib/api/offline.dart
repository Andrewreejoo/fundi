import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Last good response per API path, so lists still show when the network drops.
class OfflineCache {
  static const _prefix = 'cache:';

  Future<void> put(String path, dynamic value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_prefix$path', jsonEncode({'at': DateTime.now().toIso8601String(), 'v': value}));
  }

  Future<dynamic> get(String path) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_prefix$path');
    if (raw == null) return null;
    return (jsonDecode(raw) as Map<String, dynamic>)['v'];
  }
}

/// A write the user made while offline (e.g. "mark job done"), replayed when the connection returns.
class QueuedAction {
  QueuedAction(this.path, this.body, this.label);
  final String path;
  final Map<String, dynamic> body;
  final String label;

  Map<String, dynamic> toJson() => {'path': path, 'body': body, 'label': label};
  static QueuedAction fromJson(Map<String, dynamic> j) =>
      QueuedAction(j['path'] as String, Map<String, dynamic>.from(j['body'] as Map), j['label'] as String);
}

class OfflineQueue {
  static const _key = 'queue:v1';

  Future<List<QueuedAction>> all() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => QueuedAction.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> add(QueuedAction a) async {
    final list = await all();
    if (list.any((x) => x.path == a.path)) return; // same action already waiting
    list.add(a);
    await _save(list);
  }

  Future<void> _save(List<QueuedAction> list) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(list.map((e) => e.toJson()).toList()));
  }

  /// Try each queued action once. Actions that fail for a reason other than "offline" are dropped
  /// (the server said no, e.g. the booking already moved on), so the queue never jams.
  Future<int> flush(Future<dynamic> Function(String path, Map<String, dynamic> body) send,
      bool Function(Object error) isOffline) async {
    final list = await all();
    final remaining = <QueuedAction>[];
    var sent = 0;
    for (final a in list) {
      try {
        await send(a.path, a.body);
        sent++;
      } catch (e) {
        if (isOffline(e)) remaining.add(a);
      }
    }
    await _save(remaining);
    return sent;
  }
}
