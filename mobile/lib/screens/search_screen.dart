import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'location_picker.dart';
import 'provider_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.category, this.q});
  final String? category;
  final String? q;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  bool verified = false, today = false, home = false;
  Future<Map<String, dynamic>>? _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final s = context.read<AppState>();
    final loc = s.location!;
    final qs = Uri(queryParameters: {
      ...loc.query,
      if (widget.category != null) 'category': widget.category!,
      if (widget.q != null) 'q': widget.q!,
      if (verified) 'verifiedOnly': 'true',
      if (today) 'availableToday': 'true',
      if (home) 'homeVisit': 'true',
    }).query;
    setState(() {
      _future = s.api.get('/providers/search?$qs', cacheable: true).then((r) => Map<String, dynamic>.from(r as Map));
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final cat = s.categories.where((c) => c['slug'] == widget.category).firstOrNull;
    final title = cat != null ? s.catName(cat) : (widget.q ?? s.t('trusted_near'));
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Column(children: [
        const OfflineBanner(),
        Container(
          color: FundiColors.surface,
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            InkWell(
              onTap: () async {
                final l = await pickLocation(context);
                if (l != null) {
                  await s.setLocation(l);
                  _load();
                }
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  const Icon(Icons.place_outlined, size: 18, color: FundiColors.orange),
                  const SizedBox(width: 6),
                  Text(s.location?.label ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(width: 8),
                  Text(s.t('change'), style: const TextStyle(color: FundiColors.green)),
                ]),
              ),
            ),
            Wrap(spacing: 8, runSpacing: 6, children: [
              FilterChip(label: Text(s.t('verified_only')), selected: verified, onSelected: (v) { verified = v; _load(); }),
              FilterChip(label: Text(s.t('available_today')), selected: today, onSelected: (v) { today = v; _load(); }),
              FilterChip(label: Text(s.t('home_visit')), selected: home, onSelected: (v) { home = v; _load(); }),
            ]),
          ]),
        ),
        Expanded(
          child: FutureBuilder<Map<String, dynamic>>(
            future: _future,
            builder: (context, snap) {
              if (snap.hasError) return ErrorRetry(error: snap.error!, onRetry: _load);
              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
              final results = List<Map<String, dynamic>>.from(snap.data!['results'] as List);
              if (results.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('${s.t('no_results')}.', textAlign: TextAlign.center, style: const TextStyle(fontSize: 17)),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async => _load(),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: results.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    if (i == 0) {
                      return Text('${results.length} · ${s.t('within_km')} ${snap.data!['radiusKm']} km',
                          style: const TextStyle(color: FundiColors.muted));
                    }
                    final p = results[i - 1];
                    return ProviderCard(
                      p: p,
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute(builder: (_) => ProviderScreen(providerId: p['id'] as String))),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}
