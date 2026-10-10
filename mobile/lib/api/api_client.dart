import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;

import '../config.dart';
import 'offline.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message);
  final int status;
  final String message;

  /// True when the phone had no connection (or the server could not be reached).
  bool get isOffline => status == 0;

  @override
  String toString() => message;
}

/// Thin JSON client for the Fundi API. Tokens live in the platform's secure storage.
/// GET responses for catalog-like paths are cached so the app keeps working on a bad connection.
class Api {
  Api({String? baseUrl, http.Client? client})
      : baseUrl = (baseUrl ?? AppConfig.apiUrl).replaceAll(RegExp(r'/$'), ''),
        _http = client ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  final _storage = const FlutterSecureStorage();
  final cache = OfflineCache();

  String? _access;
  String? _refresh;
  bool get signedIn => _refresh != null;

  static const _timeout = Duration(seconds: 25);

  Future<void> loadTokens() async {
    _access = await _storage.read(key: 'access');
    _refresh = await _storage.read(key: 'refresh');
  }

  Future<void> saveTokens(Map<String, dynamic> tokens) async {
    _access = tokens['accessToken'] as String?;
    _refresh = tokens['refreshToken'] as String?;
    await _storage.write(key: 'access', value: _access);
    await _storage.write(key: 'refresh', value: _refresh);
  }

  Future<void> clearTokens() async {
    _access = null;
    _refresh = null;
    await _storage.delete(key: 'access');
    await _storage.delete(key: 'refresh');
  }

  String fileUrl(String id) => '$baseUrl/files/$id';

  Map<String, String> get _headers => {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        if (_access != null) 'Authorization': 'Bearer $_access',
      };

  Future<dynamic> get(String path, {bool cacheable = false}) async {
    try {
      final res = await _send(() => _http.get(Uri.parse('$baseUrl$path'), headers: _headers));
      if (cacheable) await cache.put(path, res);
      return res;
    } on ApiException catch (e) {
      if (e.isOffline && cacheable) {
        final cached = await cache.get(path);
        if (cached != null) return cached;
      }
      rethrow;
    }
  }

  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _send(() => _http.post(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body ?? {})));

  Future<dynamic> patch(String path, Map<String, dynamic> body) =>
      _send(() => _http.patch(Uri.parse('$baseUrl$path'), headers: _headers, body: jsonEncode(body)));

  /// Upload a photo. Private files (ID, selfie) are only visible to the owner and admins.
  Future<Map<String, dynamic>> upload(File file, {bool private = false}) async {
    Future<http.Response> send() async {
      final req = http.MultipartRequest('POST', Uri.parse('$baseUrl/uploads${private ? '?private=true' : ''}'));
      if (_access != null) req.headers['Authorization'] = 'Bearer $_access';
      final lower = file.path.toLowerCase();
      final type = lower.endsWith('.png') ? 'png' : lower.endsWith('.webp') ? 'webp' : 'jpeg';
      req.files.add(await http.MultipartFile.fromPath('file', file.path, contentType: MediaType('image', type)));
      return http.Response.fromStream(await _http.send(req).timeout(const Duration(seconds: 90)));
    }

    return (await _send(send)) as Map<String, dynamic>;
  }

  Future<dynamic> _send(Future<http.Response> Function() call, {bool retried = false}) async {
    http.Response res;
    try {
      res = await call().timeout(_timeout);
    } on SocketException {
      throw ApiException(0, 'No connection. Check your data or try again.');
    } on TimeoutException {
      throw ApiException(0, 'The network is slow. Try again.');
    } on http.ClientException {
      throw ApiException(0, 'No connection. Check your data or try again.');
    }
    if (res.statusCode == 401 && !retried && _refresh != null && await _tryRefresh()) {
      return _send(call, retried: true);
    }
    dynamic body;
    try {
      body = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      body = null;
    }
    if (res.statusCode >= 400) {
      final m = body is Map ? body['message'] : null;
      final msg = m is List ? m.join('. ') : (m is String ? m : 'Something went wrong (${res.statusCode})');
      throw ApiException(res.statusCode, msg);
    }
    return body;
  }

  Future<bool> _tryRefresh() async {
    try {
      final res = await _http
          .post(Uri.parse('$baseUrl/auth/refresh'),
              headers: {'Content-Type': 'application/json'}, body: jsonEncode({'refreshToken': _refresh}))
          .timeout(_timeout);
      if (res.statusCode != 200) {
        await clearTokens();
        return false;
      }
      await saveTokens(jsonDecode(res.body) as Map<String, dynamic>);
      return true;
    } catch (_) {
      return false;
    }
  }
}

