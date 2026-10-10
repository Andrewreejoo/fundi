import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';
import '../../util/format.dart';
import '../location_picker.dart';
import '../login_screen.dart';

/// Five screens, one question each, a big Listen button on every screen (spec 2.2).
/// Progress survives backgrounding because each answer is kept in this state object.
class SignupWizard extends StatefulWidget {
  const SignupWizard({super.key});

  @override
  State<SignupWizard> createState() => _SignupWizardState();
}

class _SignupWizardState extends State<SignupWizard> {
  int step = 0;
  final trades = <String>{};
  final name = TextEditingController();
  final payout = TextEditingController();
  final service = TextEditingController();
  final price = TextEditingController();
  final landmark = TextEditingController();
  SavedLocation? place;
  String priceType = 'fixed';
  bool busy = false;

  static const _audio = ['signup_trade', 'signup_name', 'signup_area', 'signup_payout', 'signup_service'];
  static const _questions = ['q_trade', 'q_name', 'q_area', 'q_payout', 'q_service'];

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    name.text = (s.user?['name'] as String?) ?? '';
    payout.text = localPhone(s.user?['phone'] as String?);
    place = s.location?.placeId != null ? s.location : null;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!await LoginScreen.ensure(context) && mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    for (final c in [name, payout, service, price, landmark]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _valid => switch (step) {
        0 => trades.isNotEmpty,
        1 => name.text.trim().length >= 2,
        2 => place != null,
        3 => normalizeMwPhone(payout.text) != null,
        _ => service.text.trim().length >= 3 && (priceType == 'quote' || (int.tryParse(price.text) ?? 0) >= 100),
      };

  Future<void> _finish() async {
    final s = context.read<AppState>();
    setState(() => busy = true);
    try {
      await s.api.post('/providers', {
        'displayName': name.text.trim(),
        'trades': trades.toList(),
        ...place!.body,
        if (landmark.text.trim().isNotEmpty) 'landmark': landmark.text.trim(),
        'payoutPhone': payout.text,
      });
      await s.api.post('/providers/me/listings', {
        'categorySlug': trades.first,
        'title': service.text.trim(),
        'priceType': priceType,
        if (priceType != 'quote') 'priceMwk': int.parse(price.text),
      });
      await s.refreshMe();
      await s.setProviderMode(true);
      if (!mounted) return;
      Navigator.of(context).popUntil((r) => r.isFirst);
      showInfo(context, 'Takulandirani! You are now on Fundi.');
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          for (var i = 0; i < 5; i++)
            Container(
              width: 26,
              height: 9,
              margin: const EdgeInsets.only(right: 6),
              decoration: BoxDecoration(color: i <= step ? FundiColors.green : FundiColors.line, borderRadius: BorderRadius.circular(5)),
            ),
          const Spacer(),
          Text('${step + 1} / 5', style: const TextStyle(fontSize: 15, color: FundiColors.muted)),
        ]),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Center(child: ListenButton(_audio[step], big: true)),
            const SizedBox(height: 16),
            Text(tr(Lang.ny, _questions[step]), textAlign: TextAlign.center, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, height: 1.2)),
            Text(tr(Lang.en, _questions[step]), textAlign: TextAlign.center, style: const TextStyle(color: FundiColors.muted, fontSize: 16)),
            const SizedBox(height: 20),
            Expanded(child: SingleChildScrollView(child: _body(s))),
            FilledButton(
              onPressed: !_valid || busy ? null : () => step < 4 ? setState(() => step++) : _finish(),
              child: busy ? const CircularProgressIndicator(color: Colors.white) : Text('${s.t('continue')} →'),
            ),
            TextButton(
              onPressed: step == 0 ? () => Navigator.of(context).pop() : () => setState(() => step--),
              child: Text(step == 0 ? s.t('cancel') : '←'),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _body(AppState s) {
    switch (step) {
      case 0:
        return GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.45,
          children: [
            for (final c in s.categories)
              _tradeTile(s, c, trades.contains(c['slug'])),
          ],
        );
      case 1:
        return TextField(
          controller: name,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          style: const TextStyle(fontSize: 20),
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(hintText: 'e.g. Chikondi Phiri'),
        );
      case 2:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          OutlinedButton.icon(
            onPressed: () async {
              final l = await pickLocation(context);
              if (l != null) setState(() => place = l);
            },
            icon: const Icon(Icons.place_outlined),
            label: Text(place?.label ?? s.t('choose_area')),
          ),
          const SizedBox(height: 12),
          TextField(controller: landmark, decoration: const InputDecoration(labelText: 'Landmark near your workshop (optional)')),
        ]);
      case 3:
        return Column(children: [
          TextField(
            controller: payout,
            keyboardType: TextInputType.phone,
            style: const TextStyle(fontSize: 20),
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Airtel Money or TNM Mpamba number', prefixIcon: Icon(Icons.account_balance_wallet_outlined)),
          ),
        ]);
      default:
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(controller: service, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Service name', hintText: 'e.g. Leak repair')),
          const SizedBox(height: 12),
          Wrap(spacing: 8, children: [
            for (final pt in ['fixed', 'from', 'quote'])
              ChoiceChip(
                label: Text(s.t(pt == 'fixed' ? 'fixed_price' : pt == 'from' ? 'from_price' : 'quote')),
                selected: priceType == pt,
                onSelected: (_) => setState(() => priceType = pt),
              ),
          ]),
          if (priceType != 'quote') ...[
            const SizedBox(height: 12),
            TextField(
              controller: price,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(labelText: s.t('price_mwk')),
            ),
          ],
          const SizedBox(height: 8),
          const Text('Our team checks new services. Verify your ID later to go live faster.', style: TextStyle(color: FundiColors.muted, fontSize: 14)),
        ]);
    }
  }

  Widget _tradeTile(AppState s, Map<String, dynamic> c, bool selected) => Material(
        color: selected ? FundiColors.greenTint : FundiColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: selected ? FundiColors.green : const Color(0xFFD6CFC2), width: selected ? 3 : 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => setState(() {
            final slug = c['slug'] as String;
            if (!trades.remove(slug) && trades.length < 4) trades.add(slug);
          }),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(categoryIcon(c['icon'] as String?), size: 32, color: selected ? FundiColors.green : FundiColors.ink),
            const SizedBox(height: 4),
            Text(s.catName(c), textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700, color: selected ? FundiColors.green : FundiColors.ink)),
          ]),
        ),
      );
}
