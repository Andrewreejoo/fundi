import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

/// Bottom sheet: use GPS, or pick district -> area from a list (works with GPS off).
Future<SavedLocation?> pickLocation(BuildContext context) {
  return showModalBottomSheet<SavedLocation>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => const _LocationSheet(),
  );
}

class _LocationSheet extends StatefulWidget {
  const _LocationSheet();

  @override
  State<_LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends State<_LocationSheet> {
  bool locating = false;

  Future<void> _gps() async {
    setState(() => locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) throw ApiException(400, 'Turn on location in your phone settings, or choose your area below.');
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        throw ApiException(400, 'Location permission was not given. Choose your area below.');
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)),
      );
      if (!mounted) return;
      Navigator.of(context).pop(SavedLocation(lat: pos.latitude, lng: pos.longitude, label: 'My location'));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final byDistrict = <String, List<Map<String, dynamic>>>{};
    for (final p in s.places) {
      byDistrict.putIfAbsent(p['district'] as String, () => []).add(p);
    }
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (context, controller) => ListView(controller: controller, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Text(s.t('choose_area'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: locating ? null : _gps,
          icon: locating
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.my_location),
          label: Text(s.t('use_gps')),
        ),
        const SizedBox(height: 16),
        for (final entry in byDistrict.entries) ...[
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            child: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w700, color: FundiColors.muted)),
          ),
          for (final p in entry.value)
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              minTileHeight: 52,
              leading: const Icon(Icons.place_outlined, color: FundiColors.orange),
              title: Text(p['name'] as String, style: const TextStyle(fontSize: 17)),
              selected: s.location?.placeId == p['id'],
              onTap: () => Navigator.of(context)
                  .pop(SavedLocation(placeId: p['id'] as int, label: '${p['name']}, ${p['district']}')),
            ),
        ],
      ]),
    );
  }
}
