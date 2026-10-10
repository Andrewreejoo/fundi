import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/strings.dart';
import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'location_picker.dart';
import 'provider_screen.dart';
import 'search_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? trusted;
  String? _loadedFor;

  Future<void> _loadTrusted(AppState s) async {
    final loc = s.location;
    if (loc == null) return;
    final key = loc.label;
    if (_loadedFor == key) return;
    _loadedFor = key;
    try {
      final qs = Uri(queryParameters: {...loc.query, 'verifiedOnly': 'true', 'limit': '1'}).query;
      final r = await s.api.get('/providers/search?$qs', cacheable: true) as Map;
      final list = r['results'] as List;
      if (mounted) setState(() => trusted = list.isEmpty ? null : Map<String, dynamic>.from(list.first as Map));
    } catch (_) {}
  }

  Future<void> _chooseLocation() async {
    final s = context.read<AppState>();
    final l = await pickLocation(context);
    if (l != null) await s.setLocation(l);
  }

  void _openSearch({String? category, String? q}) async {
    final s = context.read<AppState>();
    if (s.location == null) {
      final l = await pickLocation(context);
      if (l == null) return;
      await s.setLocation(l);
    }
    if (!mounted) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => SearchScreen(category: category, q: q)));
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    _loadTrusted(s);
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            _loadedFor = null;
            await s.loadCatalog();
            await _loadTrusted(s);
          },
          child: ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 24), children: [
            const OfflineBanner(),
            Row(children: [
              const Text('fundi', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w700, color: FundiColors.green)),
              const Spacer(),
              OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size(48, 44), side: const BorderSide(color: Color(0xFFD6CFC2))),
                onPressed: () => s.setLang(s.lang == Lang.ny ? Lang.en : Lang.ny),
                child: Text(s.lang == Lang.ny ? 'English' : 'Chichewa', style: const TextStyle(color: FundiColors.ink)),
              ),
              const SizedBox(width: 8),
              const ListenButton('home'),
            ]),
            const SizedBox(height: 14),
            Material(
              color: FundiColors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: FundiColors.line)),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: _chooseLocation,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(children: [
                    const Icon(Icons.place_outlined, color: FundiColors.orange),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(s.location?.label ?? s.t('choose_area'),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
                    Text(s.t('change'), style: const TextStyle(color: FundiColors.green, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(s.t('what_need'), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, height: 1.15)),
            const SizedBox(height: 4),
            Text(s.t('what_need_sub'), style: const TextStyle(color: FundiColors.muted)),
            const SizedBox(height: 14),
            TextField(
              textInputAction: TextInputAction.search,
              onSubmitted: (v) => _openSearch(q: v.trim().isEmpty ? null : v.trim()),
              decoration: InputDecoration(hintText: s.t('search_hint'), prefixIcon: const Icon(Icons.search)),
            ),
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.95,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (final c in s.categories)
                  Material(
                    color: FundiColors.surface,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: FundiColors.line)),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _openSearch(category: c['slug'] as String),
                      child: Padding(
                        padding: const EdgeInsets.all(6),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(categoryIcon(c['icon'] as String?), size: 30, color: FundiColors.green),
                          const SizedBox(height: 6),
                          Text(s.catName(c), textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          if (s.lang == Lang.ny)
                            Text(c['name_en'] as String, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 11.5, color: FundiColors.muted)),
                        ]),
                      ),
                    ),
                  ),
              ],
            ),
            if (s.categories.isEmpty)
              Padding(padding: const EdgeInsets.all(24), child: ErrorRetry(error: s.t('offline'), onRetry: s.loadCatalog)),
            if (trusted != null) ...[
              const SizedBox(height: 22),
              Text(s.t('trusted_near'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ProviderCard(
                p: trusted!,
                onTap: () => Navigator.of(context)
                    .push(MaterialPageRoute(builder: (_) => ProviderScreen(providerId: trusted!['id'] as String))),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}
