import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../../util/format.dart';
import '../bookings_screen.dart';
import 'add_listing_screen.dart';
import 'verification_screen.dart';

class ProviderDashboardScreen extends StatefulWidget {
  const ProviderDashboardScreen({super.key});

  @override
  State<ProviderDashboardScreen> createState() => _ProviderDashboardScreenState();
}

class _ProviderDashboardScreenState extends State<ProviderDashboardScreen> {
  Map<String, dynamic>? me;
  List<Map<String, dynamic>> active = [];
  Object? error;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<AppState>().api;
    try {
      final r = await Future.wait([api.get('/providers/me', cacheable: true), api.get('/bookings?as=provider&scope=active', cacheable: true)]);
      if (!mounted) return;
      setState(() {
        me = Map<String, dynamic>.from(r[0] as Map);
        active = List<Map<String, dynamic>>.from((r[1] as List).map((e) => Map<String, dynamic>.from(e as Map)));
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> _toggleAvailable() async {
    setState(() => busy = true);
    try {
      await context.read<AppState>().api.patch('/providers/me', {'availableToday': !(me!['available_today'] as bool)});
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _setListing(String id, String status) async {
    try {
      await context.read<AppState>().api.patch('/providers/me/listings/$id', {'status': status});
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (me == null) {
      return Scaffold(body: SafeArea(child: error != null ? ErrorRetry(error: error!, onRetry: _load) : const Center(child: CircularProgressIndicator())));
    }
    final m = me!;
    final earnings = Map<String, dynamic>.from(m['earnings'] as Map);
    final requests = active.where((b) => b['status'] == 'requested').toList();
    final ongoing = active.where((b) => b['status'] != 'requested').toList();
    final listings = List<Map<String, dynamic>>.from(m['listings'] as List);
    final verification = m['verification'] as Map?;
    final available = m['available_today'] == true;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            const OfflineBanner(),
            Row(children: [
              Expanded(child: Text('${s.t('hello')}, ${(m['display_name'] as String).split(' ').first}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700))),
              FilterChip(
                selected: available,
                onSelected: busy ? null : (_) => _toggleAvailable(),
                label: Text(available ? s.t('available_toggle') : 'Not available'),
                avatar: Icon(Icons.circle, size: 12, color: available ? FundiColors.green : FundiColors.muted),
                showCheckmark: false,
              ),
            ]),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: FundiColors.green, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                Expanded(child: _money(s.t('paid_week'), mwk(earnings['paid_7d'] as num), walletName(m['payout_operator'] as String?))),
                Expanded(child: _money(s.t('held'), mwk(earnings['held_in_escrow'] as num), 'until customers confirm')),
              ]),
            ),
            const SizedBox(height: 18),
            Text(s.t('new_requests'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (requests.isEmpty)
              const Text('No new requests. Keep "Available" on so customers see you first.', style: TextStyle(color: FundiColors.muted)),
            for (final b in requests) Padding(padding: const EdgeInsets.only(bottom: 10), child: BookingTile(b: b, asProvider: true, onReturn: _load)),
            if (ongoing.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(s.t('ongoing'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final b in ongoing) Padding(padding: const EdgeInsets.only(bottom: 10), child: BookingTile(b: b, asProvider: true, onReturn: _load)),
            ],
            const SizedBox(height: 10),
            Card(
              child: ListTile(
                minTileHeight: 64,
                leading: const Icon(Icons.verified_user_outlined, color: FundiColors.green),
                title: Row(children: [Text(s.t('verify_id'), style: const TextStyle(fontWeight: FontWeight.w700)), const Spacer(), LevelBadge(m['verification_level'] as String?)]),
                subtitle: Text(m['verification_level'] != 'basic'
                    ? 'Verified. 10 jobs at 4.5★ earns Fundi Trusted.'
                    : verification?['status'] == 'pending'
                        ? 'Being checked (usually under 24 h)'
                        : verification?['status'] == 'rejected'
                            ? 'Not accepted: ${verification!['reason']}. Try again.'
                            : 'Rank higher and get the verified tick'),
                onTap: m['verification_level'] == 'basic' && verification?['status'] != 'pending'
                    ? () async {
                        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const VerificationScreen()));
                        _load();
                      }
                    : null,
              ),
            ),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: Text(s.t('services'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
              TextButton.icon(
                onPressed: () async {
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => AddListingScreen(trades: List<Map<String, dynamic>>.from(m['trades'] as List))));
                  _load();
                },
                icon: const Icon(Icons.add),
                label: Text(s.t('add_service')),
              ),
            ]),
            for (final l in listings)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    title: Text(l['title'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(l['price_type'] == 'quote'
                        ? s.t('ask_quote')
                        : '${l['price_type'] == 'from' ? '${s.t('from')} ' : ''}${mwk(l['price_mwk'] as num?)}'
                            '${l['reject_reason'] != null ? '\n${l['reject_reason']}' : ''}'),
                    trailing: switch (l['status']) {
                      'live' => TextButton(onPressed: () => _setListing(l['id'] as String, 'paused'), child: const Text('Pause')),
                      'paused' => TextButton(onPressed: () => _setListing(l['id'] as String, 'live'), child: const Text('Show')),
                      'pending' => const Pill('Being checked', bg: FundiColors.orangeTint, fg: Color(0xFF8A3409)),
                      _ => const Pill('Rejected', bg: FundiColors.redTint, fg: FundiColors.red),
                    },
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _money(String label, String value, String sub) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(color: Color(0xFFCFE3D6), fontSize: 13)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
        Text(sub, style: const TextStyle(color: Color(0xFFCFE3D6), fontSize: 12)),
      ]);
}
