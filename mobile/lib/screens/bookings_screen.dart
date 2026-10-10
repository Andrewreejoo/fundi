import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';
import 'booking_screen.dart';
import 'login_screen.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key, this.asProvider = false});
  final bool asProvider;

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  String scope = 'active';
  Future<List<Map<String, dynamic>>>? _future;

  void _load() {
    final s = context.read<AppState>();
    if (!s.signedIn) return;
    final as = widget.asProvider ? 'provider' : 'customer';
    setState(() {
      _future = s.api
          .get('/bookings?as=$as&scope=$scope', cacheable: true)
          .then((r) => List<Map<String, dynamic>>.from((r as List).map((e) => Map<String, dynamic>.from(e as Map))));
    });
  }

  @override
  void didUpdateWidget(covariant BookingsScreen old) {
    super.didUpdateWidget(old);
    if (old.asProvider != widget.asProvider) _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (s.signedIn && _future == null) WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    return Scaffold(
      appBar: AppBar(title: Text(s.t('tab_bookings'))),
      body: !s.signedIn
          ? Center(
              child: FilledButton(
                onPressed: () async {
                  if (await LoginScreen.ensure(context)) _load();
                },
                child: Text(s.t('sign_in')),
              ),
            )
          : Column(children: [
              const OfflineBanner(),
              Padding(
                padding: const EdgeInsets.all(16),
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'active', label: Text('Active')),
                    ButtonSegment(value: 'past', label: Text('Past')),
                  ],
                  selected: {scope},
                  onSelectionChanged: (v) {
                    scope = v.first;
                    _load();
                  },
                ),
              ),
              Expanded(
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: _future,
                  builder: (context, snap) {
                    if (snap.hasError) return ErrorRetry(error: snap.error!, onRetry: _load);
                    if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                    final list = snap.data!;
                    return RefreshIndicator(
                      onRefresh: () async => _load(),
                      child: list.isEmpty
                          ? ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Nothing here yet.')))])
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                              itemCount: list.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (_, i) => BookingTile(b: list[i], asProvider: widget.asProvider, onReturn: _load),
                            ),
                    );
                  },
                ),
              ),
            ]),
    );
  }
}

class BookingTile extends StatelessWidget {
  const BookingTile({super.key, required this.b, required this.asProvider, this.onReturn});
  final Map<String, dynamic> b;
  final bool asProvider;
  final VoidCallback? onReturn;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    final urgent = asProvider && b['status'] == 'requested';
    return Card(
      shape: urgent
          ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: FundiColors.orange, width: 2))
          : null,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookingScreen(bookingId: b['id'] as String)));
          onReturn?.call();
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text((b['listing_title'] as String?) ?? s.catName(b),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              ),
              StatusPill(b['status'] as String),
            ]),
            const SizedBox(height: 4),
            Text(
              '${asProvider ? b['customer_name'] : b['provider_name']} · ${b['ref']}'
              '${b['scheduled_for'] != null ? ' · ${dateLabel(b['scheduled_for'] as String)}' : ''}',
              style: const TextStyle(color: FundiColors.muted, fontSize: 14),
            ),
            if (b['price_mwk'] != null) Text(mwk(b['price_mwk'] as num), style: const TextStyle(fontWeight: FontWeight.w700)),
            if (urgent && timeLeft(b['expires_at'] as String?) != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Pill('Reply in ${timeLeft(b['expires_at'] as String?)}', bg: FundiColors.orangeTint, fg: const Color(0xFF8A3409)),
              ),
          ]),
        ),
      ),
    );
  }
}
