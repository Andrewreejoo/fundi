import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';
import 'booking_screen.dart';
import 'location_picker.dart';

class BookScreen extends StatefulWidget {
  const BookScreen({super.key, required this.provider, this.listingId});
  final Map<String, dynamic> provider;
  final String? listingId;

  @override
  State<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends State<BookScreen> {
  late String listing; // a listing id, or 'quote'
  int? categoryId;
  DateTime day = DateTime.now();
  String slot = 'afternoon';
  bool escrow = true;
  bool busy = false;
  final description = TextEditingController();
  final landmark = TextEditingController();

  List<Map<String, dynamic>> get listings => List<Map<String, dynamic>>.from(widget.provider['listings'] as List);
  List<Map<String, dynamic>> get trades => List<Map<String, dynamic>>.from(widget.provider['trades'] as List);
  Map<String, dynamic>? get chosen => listings.where((l) => l['id'] == listing).firstOrNull;
  bool get isFixed => chosen?['price_type'] == 'fixed';

  @override
  void initState() {
    super.initState();
    listing = widget.listingId ?? (listings.isNotEmpty ? listings.first['id'] as String : 'quote');
    categoryId = trades.isNotEmpty ? trades.first['id'] as int : null;
    _defaultEscrow();
  }

  @override
  void dispose() {
    description.dispose();
    landmark.dispose();
    super.dispose();
  }

  void _defaultEscrow() {
    final min = (context.read<AppState>().settings['escrowDefaultMinMwk'] as num?) ?? 20000;
    escrow = !isFixed || (chosen!['price_mwk'] as num) >= min;
  }

  int get fee {
    if (!isFixed || !escrow) return 0;
    final st = context.read<AppState>().settings;
    final pct = (st['protectionFeePercent'] as num?) ?? 2;
    final min = (st['protectionFeeMinMwk'] as num?) ?? 200;
    final f = ((chosen!['price_mwk'] as num) * pct / 100).round();
    return f < min ? min.toInt() : f;
  }

  Future<void> _submit() async {
    final s = context.read<AppState>();
    if (!isFixed && description.text.trim().isEmpty) {
      showError(context, 'Describe the job so the fundi can give you a price.');
      return;
    }
    if (s.location == null) {
      final l = await pickLocation(context);
      if (l == null) return;
      await s.setLocation(l);
    }
    setState(() => busy = true);
    try {
      final r = await s.api.post('/bookings', {
        'providerId': widget.provider['id'],
        if (listing != 'quote') 'listingId': listing else 'categoryId': categoryId,
        if (description.text.trim().isNotEmpty) 'description': description.text.trim(),
        'scheduledFor': isoDate(day),
        'timeSlot': slot,
        if (landmark.text.trim().isNotEmpty) 'landmark': landmark.text.trim(),
        'escrow': escrow,
        'channel': 'app',
        ...s.location!.body,
      }) as Map;
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => BookingScreen(bookingId: r['id'] as String, isNew: true)));
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final p = widget.provider;
    final first = (p['display_name'] as String).split(' ').first;
    final today = DateTime.now();
    final tomorrow = today.add(const Duration(days: 1));
    return Scaffold(
      appBar: AppBar(title: Text('${s.t('book')} · $first'), actions: const [Padding(padding: EdgeInsets.only(right: 12), child: ListenButton('book'))]),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Text(s.t('services'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        const SizedBox(height: 6),
        RadioGroup<String>(
          groupValue: listing,
          onChanged: (v) => setState(() {
            listing = v!;
            _defaultEscrow();
          }),
          child: Column(children: [
            for (final l in listings)
              RadioListTile<String>(
                value: l['id'] as String,
                title: Text(l['title'] as String),
                secondary: Text(l['price_type'] == 'quote'
                    ? s.t('ask_quote')
                    : '${l['price_type'] == 'from' ? '${s.t('from')} ' : ''}${mwk(l['price_mwk'] as num?)}'),
              ),
            RadioListTile<String>(value: 'quote', title: Text(s.t('something_else')), secondary: Text(s.t('ask_quote'))),
          ]),
        ),
        if (listing == 'quote' && trades.length > 1)
          DropdownButtonFormField<int>(
            initialValue: categoryId,
            items: [for (final c in trades) DropdownMenuItem(value: c['id'] as int, child: Text(s.catName(c)))],
            onChanged: (v) => setState(() => categoryId = v),
          ),
        const SizedBox(height: 14),
        TextField(
          controller: description,
          maxLines: 3,
          maxLength: 1000,
          decoration: InputDecoration(labelText: s.t('describe_job'), hintText: 'e.g. The kitchen tap leaks under the sink'),
        ),
        Text(s.t('when'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          ChoiceChip(label: Text(s.t('today')), selected: isoDate(day) == isoDate(today), onSelected: (_) => setState(() => day = today)),
          ChoiceChip(label: Text(s.t('tomorrow')), selected: isoDate(day) == isoDate(tomorrow), onSelected: (_) => setState(() => day = tomorrow)),
          ActionChip(
            avatar: const Icon(Icons.calendar_month, size: 18),
            label: Text(isoDate(day) != isoDate(today) && isoDate(day) != isoDate(tomorrow) ? dateLabel(isoDate(day)) : 'Other day'),
            onPressed: () async {
              final d = await showDatePicker(context: context, firstDate: today, lastDate: today.add(const Duration(days: 60)), initialDate: day);
              if (d != null) setState(() => day = d);
            },
          ),
        ]),
        const SizedBox(height: 8),
        Wrap(spacing: 8, children: [
          for (final sl in ['morning', 'afternoon', 'evening'])
            ChoiceChip(label: Text(s.t(sl)), selected: slot == sl, onSelected: (_) => setState(() => slot = sl)),
        ]),
        const SizedBox(height: 16),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.place_outlined, color: FundiColors.orange),
          title: Text(s.location?.label ?? s.t('choose_area'), style: const TextStyle(fontWeight: FontWeight.w700)),
          trailing: Text(s.t('change'), style: const TextStyle(color: FundiColors.green)),
          onTap: () async {
            final l = await pickLocation(context);
            if (l != null) await s.setLocation(l);
          },
        ),
        TextField(controller: landmark, maxLength: 160, decoration: InputDecoration(labelText: s.t('landmark'), hintText: 'e.g. Behind Area 25 market, blue gate')),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: escrow ? const Color(0xFFFFF6E6) : FundiColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: escrow ? const Color(0xFFF0D9A8) : FundiColors.line),
          ),
          child: SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: escrow,
            onChanged: isFixed ? (v) => setState(() => escrow = v) : null,
            secondary: const Icon(Icons.shield_outlined, color: FundiColors.gold),
            title: Text(s.t('escrow_title'), style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(s.t('escrow_body')),
          ),
        ),
        if (isFixed) ...[
          const SizedBox(height: 12),
          _line('Job', mwk(chosen!['price_mwk'] as num)),
          if (escrow) _line('Protection fee', mwk(fee), muted: true),
          _line('Total', mwk((chosen!['price_mwk'] as num) + fee), bold: true),
        ],
        const SizedBox(height: 20),
        FilledButton(onPressed: busy ? null : _submit, child: busy ? const CircularProgressIndicator(color: Colors.white) : Text(s.t('send_booking'))),
        const SizedBox(height: 8),
        Text(
          isFixed ? '$first has ${s.settings['instantReplyHours'] ?? 2} h to accept. You pay after they accept.' : 'No payment until you accept a price.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: FundiColors.muted, fontSize: 14),
        ),
      ]),
    );
  }

  Widget _line(String a, String b, {bool muted = false, bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Text(a, style: TextStyle(color: muted ? FundiColors.muted : null, fontWeight: bold ? FontWeight.w700 : null, fontSize: bold ? 18 : 16)),
          const Spacer(),
          Text(b, style: TextStyle(color: muted ? FundiColors.muted : null, fontWeight: bold ? FontWeight.w700 : null, fontSize: bold ? 18 : 16)),
        ]),
      );
}
