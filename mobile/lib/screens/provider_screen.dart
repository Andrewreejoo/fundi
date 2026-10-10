import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';
import 'book_screen.dart';
import 'login_screen.dart';

/// Public provider profile: photos, badges, voice-free bio, price list, reviews, and a sticky Book button.
class ProviderScreen extends StatefulWidget {
  const ProviderScreen({super.key, required this.providerId});
  final String providerId;

  @override
  State<ProviderScreen> createState() => _ProviderScreenState();
}

class _ProviderScreenState extends State<ProviderScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final s = context.read<AppState>();
    final loc = s.location;
    final qs = loc?.lat != null ? '?lat=${loc!.lat}&lng=${loc.lng}' : '';
    _future = s.api.get('/providers/${widget.providerId}$qs', cacheable: true).then((r) => Map<String, dynamic>.from(r as Map));
  }

  Future<void> _book(Map<String, dynamic> p, String? listingId) async {
    if (!await LoginScreen.ensure(context)) return;
    if (!mounted) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookScreen(provider: p, listingId: listingId)));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorRetry(error: snap.error!, onRetry: () => setState(_load));
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final p = snap.data!;
          final listings = List<Map<String, dynamic>>.from(p['listings'] as List);
          final reviews = List<Map<String, dynamic>>.from(p['reviews'] as List);
          final trades = List<Map<String, dynamic>>.from(p['trades'] as List);
          final photos = listings.expand((l) => List<String>.from(l['photo_ids'] as List)).take(6).toList();
          final rated = (p['rating_count'] as num? ?? 0) > 0;
          return Column(children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.all(20), children: [
                if (photos.isNotEmpty)
                  SizedBox(
                    height: 120,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: photos.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 6),
                      itemBuilder: (_, i) => ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.network(s.api.fileUrl(photos[i]), width: 140, height: 120, fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(width: 140, color: FundiColors.sunk)),
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                Row(children: [
                  Avatar(name: p['display_name'] as String, fileId: p['avatar_file_id'] as String?, size: 68),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(p['display_name'] as String, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                      Text('${trades.map(s.catName).join(', ')} · ${p['area']}', style: const TextStyle(color: FundiColors.muted)),
                      const SizedBox(height: 2),
                      Text(rated ? '★ ${p['rating']} · ${p['rating_count']} ${s.t('reviews')} · ${p['jobs_completed']} jobs' : s.t('new_fundi')),
                    ]),
                  ),
                ]),
                const SizedBox(height: 12),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  LevelBadge(p['verification_level'] as String?),
                  if (p['available_today'] == true) Pill(s.t('available_today'), bg: FundiColors.greenTint, fg: FundiColors.green),
                  if (p['home_visits'] == true) Pill(s.t('home_visit')),
                ]),
                if (p['bio'] != null) ...[const SizedBox(height: 12), Text(p['bio'] as String)],
                const SizedBox(height: 20),
                Text(s.t('services'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Card(
                  child: Column(children: [
                    for (final l in listings)
                      ListTile(
                        minTileHeight: 60,
                        title: Text(l['title'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: l['description'] != null ? Text(l['description'] as String) : null,
                        trailing: Text(
                          l['price_type'] == 'quote'
                              ? s.t('ask_quote')
                              : '${l['price_type'] == 'from' ? '${s.t('from')} ' : ''}${mwk(l['price_mwk'] as num?)}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        onTap: () => _book(p, l['id'] as String),
                      ),
                    ListTile(
                      minTileHeight: 56,
                      title: Text(s.t('something_else')),
                      trailing: Text(s.t('ask_quote'), style: const TextStyle(color: FundiColors.green, fontWeight: FontWeight.w700)),
                      onTap: () => _book(p, null),
                    ),
                  ]),
                ),
                const SizedBox(height: 8),
                Text('${p['service_radius_km']} km${p['work_hours'] != null ? ' · ${p['work_hours']}' : ''} · ${s.t('phone_after_booking')}',
                    style: const TextStyle(color: FundiColors.muted, fontSize: 14)),
                const SizedBox(height: 20),
                Text('${reviews.length} ${s.t('reviews')}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                for (final r in reviews)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Text(r['customer_first_name'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                            const Spacer(),
                            Text('${'★' * (r['rating'] as int)} · ${dateLabel(r['created_at'] as String?)}',
                                style: const TextStyle(color: FundiColors.muted, fontSize: 13)),
                          ]),
                          if (r['text'] != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(r['text'] as String)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
            SafeArea(
              top: false,
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                decoration: const BoxDecoration(color: FundiColors.surface, border: Border(top: BorderSide(color: FundiColors.line))),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => _book(p, listings.isNotEmpty ? listings.first['id'] as String : null),
                    child: Text('${s.t('book_now')} · ${(p['display_name'] as String).split(' ').first}'),
                  ),
                ),
              ),
            ),
          ]);
        },
      ),
    );
  }
}
