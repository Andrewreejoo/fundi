import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';

/// One booking, for either side. Buttons come from the server's `actions` list, so rules live in the API.
class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key, required this.bookingId, this.isNew = false});
  final String bookingId;
  final bool isNew;

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  Map<String, dynamic>? b;
  Object? error;
  bool busy = false;
  Timer? _poll;
  final payPhone = TextEditingController();

  @override
  void initState() {
    super.initState();
    payPhone.text = localPhone(context.read<AppState>().user?['phone'] as String?);
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    payPhone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await context.read<AppState>().api.get('/bookings/${widget.bookingId}', cacheable: true);
      if (!mounted) return;
      setState(() {
        b = Map<String, dynamic>.from(r as Map);
        error = null;
      });
      _syncPolling();
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  bool get _paymentPending =>
      (b?['payments'] as List? ?? []).any((p) => p['direction'] == 'collect' && p['status'] == 'pending');

  /// While the wallet PIN prompt is on the customer's phone, re-check every 4 seconds.
  void _syncPolling() {
    if (_paymentPending && _poll == null) {
      _poll = Timer.periodic(const Duration(seconds: 4), (_) => _load());
    } else if (!_paymentPending && _poll != null) {
      _poll!.cancel();
      _poll = null;
    }
  }

  bool can(String a) => (b?['actions'] as List? ?? []).contains(a);

  Future<void> _do(String action, {Map<String, dynamic>? body, bool queueable = false, String? confirmText}) async {
    final s = context.read<AppState>();
    if (confirmText != null && !await _confirm(confirmText)) return;
    setState(() => busy = true);
    try {
      final r = await s.act('/bookings/${widget.bookingId}/$action', body: body, queueable: queueable, label: action);
      if (!mounted) return;
      if (r == null && queueable) {
        showInfo(context, s.t('queued'));
      } else if (action == 'pay' && r is Map && r['status'] == 'failed') {
        showError(context, 'Payment failed: ${r['failure_reason'] ?? 'try again or use another wallet'}');
      }
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<bool> _confirm(String text) async {
    final s = context.read<AppState>();
    return await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            content: Text(text, style: const TextStyle(fontSize: 17)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s.t('no'))),
              FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('yes'))),
            ],
          ),
        ) ??
        false;
  }

  Future<String?> _ask(String title, {String hint = '', bool number = false}) {
    final c = TextEditingController();
    final s = context.read<AppState>();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: c,
          autofocus: true,
          maxLines: number ? 1 : 4,
          keyboardType: number ? TextInputType.number : TextInputType.text,
          inputFormatters: number ? [FilteringTextInputFormatter.digitsOnly] : null,
          decoration: InputDecoration(hintText: hint),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.t('cancel'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: Text(s.t('continue'))),
        ],
      ),
    );
  }

  Future<void> _rate() async {
    final s = context.read<AppState>();
    var stars = 5;
    final text = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(c).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(s.t('rate'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  iconSize: 44,
                  tooltip: '$i',
                  onPressed: () => set(() => stars = i),
                  icon: Icon(i <= stars ? Icons.star : Icons.star_border, color: const Color(0xFFB7791F)),
                ),
            ]),
            TextField(controller: text, maxLines: 3, decoration: const InputDecoration(hintText: 'Comment (optional)')),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.t('save'))),
          ]),
        ),
      ),
    );
    if (ok == true) {
      await _do('review', body: {'rating': stars, if (text.text.trim().isNotEmpty) 'text': text.text.trim()}, queueable: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (b == null) {
      return Scaffold(
        appBar: AppBar(),
        body: error != null ? ErrorRetry(error: error!, onRetry: _load) : const Center(child: CircularProgressIndicator()),
      );
    }
    final bk = b!;
    final isCustomer = bk['role'] == 'customer';
    final otherName = (isCustomer ? bk['provider_name'] : bk['customer_name']) as String;
    final otherPhone = (isCustomer ? bk['provider_phone'] : bk['customer_phone']) as String?;
    final payments = List<Map<String, dynamic>>.from(bk['payments'] as List);
    final lastCollect = payments.where((p) => p['direction'] == 'collect').lastOrNull;
    final events = List<Map<String, dynamic>>.from(bk['events'] as List);
    final escrow = bk['escrow'] == true;

    return Scaffold(
      appBar: AppBar(title: Text(bk['ref'] as String)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          const OfflineBanner(),
          if (widget.isNew && bk['status'] == 'requested')
            _note('Booking sent. We will SMS you when ${otherName.split(' ').first} replies.', FundiColors.greenTint, FundiColors.green),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text((bk['listing_title'] as String?) ?? s.catName(bk), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700))),
                  StatusPill(bk['status'] as String),
                ]),
                const SizedBox(height: 6),
                Text('$otherName${bk['scheduled_for'] != null ? ' · ${dateLabel(bk['scheduled_for'] as String)}' : ''}'
                    '${bk['time_slot'] != null ? ' · ${s.t(bk['time_slot'] as String)}' : ''}',
                    style: const TextStyle(color: FundiColors.muted)),
                if (bk['landmark'] != null) _iconLine(Icons.place_outlined, bk['landmark'] as String),
                if (bk['description'] != null)
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: FundiColors.sunk, borderRadius: BorderRadius.circular(10)),
                    child: Text(bk['description'] as String),
                  ),
                if (otherPhone != null)
                  otherPhone.contains('xxx')
                      ? _iconLine(Icons.phone_outlined, '${localPhone(otherPhone)} · ${s.t('phone_after_booking')}')
                      : Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: OutlinedButton.icon(
                            onPressed: () => launchUrl(Uri(scheme: 'tel', path: otherPhone)),
                            icon: const Icon(Icons.call),
                            label: Text('${s.t('call')} ${otherName.split(' ').first} · ${localPhone(otherPhone)}'),
                          ),
                        ),
              ]),
            ),
          ),
          if (bk['price_mwk'] != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  _row(bk['type'] == 'quote' ? 'Quoted price' : 'Price', mwk(bk['price_mwk'] as num), bold: true),
                  if (bk['quote_note'] != null) Align(alignment: Alignment.centerLeft, child: Text('“${bk['quote_note']}”', style: const TextStyle(color: FundiColors.muted))),
                  if (escrow && isCustomer && (bk['protection_fee_mwk'] as num) > 0) ...[
                    _row('Protection fee', mwk(bk['protection_fee_mwk'] as num)),
                    _row('Total', mwk(bk['total_mwk'] as num), bold: true),
                  ],
                  if (escrow && !isCustomer && (bk['commission_mwk'] as num) > 0) ...[
                    _row('Fundi commission', '−${mwk(bk['commission_mwk'] as num)}'),
                    _row('You receive', mwk(bk['provider_net_mwk'] as num), bold: true),
                  ],
                  const SizedBox(height: 6),
                  _iconLine(Icons.shield_outlined, escrow ? s.t('escrow_body') : 'Paid directly to the fundi.', color: FundiColors.gold),
                ]),
              ),
            ),
          ],
          const SizedBox(height: 12),
          ..._actionCards(s, bk, lastCollect),
          if (bk['review'] != null)
            _note('Your rating: ${'★' * (bk['review']['rating'] as int)}${bk['review']['text'] != null ? '\n${bk['review']['text']}' : ''}', FundiColors.surface, FundiColors.ink),
          if (bk['dispute'] != null)
            _note(
              'Problem reported: ${bk['dispute']['reason']}\n'
              '${bk['dispute']['status'] == 'open' ? 'Fundi support will call both of you by ${dateTimeLabel(bk['dispute']['sla_due_at'] as String?)}.' : 'Resolved: ${bk['dispute']['resolution']}. ${bk['dispute']['admin_note'] ?? ''}'}',
              const Color(0xFFFFF6E6), FundiColors.gold),
          const SizedBox(height: 16),
          const Text('History', style: TextStyle(fontWeight: FontWeight.w700, color: FundiColors.muted)),
          for (final e in events)
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.circle, size: 10, color: FundiColors.green),
              title: Text(s.t('st_${e['to_status']}')),
              subtitle: Text('${dateTimeLabel(e['at'] as String?)}${e['note'] != null ? ' · ${e['note']}' : ''}'),
            ),
          for (final p in payments)
            Text('${p['direction'] == 'collect' ? 'Payment' : p['direction'] == 'payout' ? 'Payout' : 'Refund'} · '
                '${walletName(p['operator'] as String?)} · ${mwk(p['amount_mwk'] as num)} · ${p['status']}',
                style: const TextStyle(fontSize: 14, color: FundiColors.muted)),
        ]),
      ),
    );
  }

  List<Widget> _actionCards(AppState s, Map<String, dynamic> bk, Map<String, dynamic>? lastCollect) {
    final out = <Widget>[];
    void add(Widget w) => out.addAll([w, const SizedBox(height: 10)]);
    final first = ((bk['role'] == 'customer' ? bk['provider_name'] : bk['customer_name']) as String).split(' ').first;

    if (_paymentPending) {
      add(_note('${s.t('waiting_pin')}\nCheck your phone for the ${walletName(payments(bk).firstWhere((p) => p['status'] == 'pending')['operator'] as String?)} prompt.',
          FundiColors.greenTint, FundiColors.green, spinner: true));
    } else if (can('pay')) {
      add(Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${s.t('pay')} ${mwk(bk['total_mwk'] as num)}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            if (lastCollect?['status'] == 'failed')
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('Last attempt failed${lastCollect!['failure_reason'] != null ? ': ${lastCollect['failure_reason']}' : ''}.',
                    style: const TextStyle(color: FundiColors.red)),
              ),
            const SizedBox(height: 10),
            TextField(controller: payPhone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: '${s.t('pay_with')} Airtel Money / TNM Mpamba')),
            if (timeLeft(bk['expires_at'] as String?) != null)
              Padding(padding: const EdgeInsets.only(top: 6), child: Text('Pay within ${timeLeft(bk['expires_at'] as String?)}', style: const TextStyle(color: FundiColors.muted))),
            const SizedBox(height: 10),
            FilledButton(onPressed: busy ? null : () => _do('pay', body: {'phone': payPhone.text}), child: Text('${s.t('pay')} ${mwk(bk['total_mwk'] as num)}')),
            const SizedBox(height: 6),
            Text(s.t('pin_prompt'), textAlign: TextAlign.center, style: const TextStyle(color: FundiColors.muted, fontSize: 14)),
          ]),
        ),
      ));
    }
    if (can('accept_quote')) {
      add(FilledButton(onPressed: busy ? null : () => _do('accept-quote'), child: Text('Accept ${mwk(bk['price_mwk'] as num)}')));
    }
    if (can('accept_or_quote')) {
      if (bk['type'] == 'instant') {
        add(FilledButton(onPressed: busy ? null : () => _do('accept'), child: Text('${s.t('accept')} · ${mwk(bk['price_mwk'] as num)}')));
      } else {
        add(FilledButton(
          onPressed: busy
              ? null
              : () async {
                  final price = await _ask(s.t('send_price'), hint: 'MWK', number: true);
                  if (price == null || price.isEmpty) return;
                  final note = await _ask('Note for $first (optional)', hint: 'e.g. Includes the new valve');
                  await _do('quote', body: {'priceMwk': int.parse(price), if (note != null && note.isNotEmpty) 'note': note});
                },
          child: Text(s.t('send_price')),
        ));
      }
      add(OutlinedButton(onPressed: busy ? null : () => _do('decline', confirmText: 'Decline this job?'), child: Text(s.t('decline'))));
    }
    if (can('start')) add(OutlinedButton(onPressed: busy ? null : () => _do('start', queueable: true), child: Text(s.t('start_job'))));
    if (can('complete')) {
      add(FilledButton(
        style: FilledButton.styleFrom(backgroundColor: FundiColors.orange),
        onPressed: busy ? null : () => _do('complete', queueable: true, confirmText: 'Is the job finished?'),
        child: Text(s.t('mark_done')),
      ));
    }
    if (can('confirm')) {
      add(Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Is the job done?', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(bk['escrow'] == true ? 'Confirming releases the payment to $first.' : 'Confirm so you can rate $first.'),
            if (timeLeft(bk['auto_confirm_at'] as String?) != null)
              Text('Confirms automatically in ${timeLeft(bk['auto_confirm_at'] as String?)}.', style: const TextStyle(color: FundiColors.muted)),
            const SizedBox(height: 10),
            FilledButton(onPressed: busy ? null : () => _do('confirm', queueable: true), child: Text(s.t('confirm_done'))),
          ]),
        ),
      ));
    }
    if (can('review')) add(FilledButton(onPressed: busy ? null : _rate, child: Text(s.t('rate'))));
    if (can('dispute')) {
      add(OutlinedButton.icon(
        style: OutlinedButton.styleFrom(foregroundColor: FundiColors.red, side: const BorderSide(color: Color(0xFFE3B5AD))),
        onPressed: busy
            ? null
            : () async {
                final reason = await _ask(s.t('report_problem'), hint: 'What went wrong?');
                if (reason != null && reason.length >= 5) await _do('dispute', body: {'reason': reason});
              },
        icon: const Icon(Icons.report_outlined),
        label: Text(s.t('report_problem')),
      ));
    }
    if (can('cancel')) {
      add(TextButton(onPressed: busy ? null : () => _do('cancel', confirmText: 'Cancel this booking?'), child: Text('${s.t('cancel')} booking')));
    }
    return out;
  }

  List<Map<String, dynamic>> payments(Map<String, dynamic> bk) => List<Map<String, dynamic>>.from(bk['payments'] as List);

  Widget _row(String a, String b, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Text(a, style: TextStyle(fontWeight: bold ? FontWeight.w700 : null)),
          const Spacer(),
          Text(b, style: TextStyle(fontWeight: bold ? FontWeight.w700 : null)),
        ]),
      );

  Widget _iconLine(IconData icon, String text, {Color color = FundiColors.muted}) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: TextStyle(color: color, fontSize: 14))),
        ]),
      );

  Widget _note(String text, Color bg, Color fg, {bool spinner = false}) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: FundiColors.line)),
        child: Row(children: [
          if (spinner) ...[const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 12)],
          Expanded(child: Text(text, style: TextStyle(color: fg, fontWeight: FontWeight.w700))),
        ]),
      );
}
