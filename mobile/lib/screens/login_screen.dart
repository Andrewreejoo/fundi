import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';

/// Phone + SMS code, then an optional 4-digit PIN for faster sign-in next time.
/// Pops `true` when the user is signed in.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  static Future<bool> ensure(BuildContext context) async {
    if (context.read<AppState>().signedIn) return true;
    final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
    return ok ?? false;
  }

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _Step { phone, code, pin, setPin }

class _LoginScreenState extends State<LoginScreen> {
  _Step step = _Step.phone;
  final phone = TextEditingController();
  final code = TextEditingController();
  final pin = TextEditingController();
  bool busy = false;
  String? devCode;

  @override
  void dispose() {
    phone.dispose();
    code.dispose();
    pin.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() => busy = true);
    try {
      await fn();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _requestCode() => _run(() async {
        if (normalizeMwPhone(phone.text) == null) throw ApiException(400, 'Enter an Airtel (099/098) or TNM (088/089) number');
        final r = await context.read<AppState>().api.post('/auth/otp/request', {'phone': phone.text});
        setState(() {
          devCode = (r as Map)['devCode'] as String?;
          step = _Step.code;
        });
      });

  Future<void> _verify() => _run(() async {
        final s = context.read<AppState>();
        final r = Map<String, dynamic>.from(await s.api.post('/auth/otp/verify', {'phone': phone.text, 'code': code.text}) as Map);
        await s.signedInWith(r);
        if (r['hasPin'] == true) {
          if (mounted) Navigator.of(context).pop(true);
        } else {
          setState(() => step = _Step.setPin);
        }
      });

  Future<void> _pinLogin() => _run(() async {
        final s = context.read<AppState>();
        final r = Map<String, dynamic>.from(await s.api.post('/auth/pin/login', {'phone': phone.text, 'pin': pin.text}) as Map);
        await s.signedInWith(r);
        if (mounted) Navigator.of(context).pop(true);
      });

  Future<void> _setPin() => _run(() async {
        await context.read<AppState>().api.post('/auth/pin', {'pin': pin.text});
        if (mounted) Navigator.of(context).pop(true);
      });

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final title = switch (step) {
      _Step.phone => s.t('sign_in'),
      _Step.code => s.t('enter_code'),
      _Step.pin => s.t('sign_in'),
      _Step.setPin => s.t('set_pin'),
    };
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(20), children: [
          if (step == _Step.phone || step == _Step.pin) ...[
            Text(s.t('phone'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
              style: const TextStyle(fontSize: 20, letterSpacing: 1),
              decoration: const InputDecoration(hintText: '0991 234 567', prefixIcon: Icon(Icons.phone)),
            ),
            const SizedBox(height: 16),
          ],
          if (step == _Step.phone) ...[
            FilledButton(onPressed: busy ? null : _requestCode, child: Text(s.t('send_code'))),
            const SizedBox(height: 12),
            TextButton(onPressed: () => setState(() => step = _Step.pin), child: Text('${s.t('sign_in')} · PIN')),
          ],
          if (step == _Step.code) ...[
            Text('SMS → ${phone.text}', style: const TextStyle(color: FundiColors.muted)),
            if (devCode != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Development code: $devCode', style: const TextStyle(color: FundiColors.gold, fontWeight: FontWeight.w700)),
              ),
            const SizedBox(height: 12),
            _digits(code, 6),
            const SizedBox(height: 16),
            FilledButton(onPressed: busy ? null : _verify, child: Text(s.t('continue'))),
            TextButton(onPressed: busy ? null : _requestCode, child: Text(s.t('send_code'))),
          ],
          if (step == _Step.pin) ...[
            Text(s.t('pin_4'), style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            _digits(pin, 4, obscure: true),
            const SizedBox(height: 16),
            FilledButton(onPressed: busy ? null : _pinLogin, child: Text(s.t('sign_in'))),
            TextButton(onPressed: () => setState(() => step = _Step.phone), child: Text(s.t('send_code'))),
          ],
          if (step == _Step.setPin) ...[
            const Text('Next time, sign in with your number and this PIN. Do not use your mobile money PIN.'),
            const SizedBox(height: 12),
            _digits(pin, 4, obscure: true),
            const SizedBox(height: 16),
            FilledButton(onPressed: busy ? null : _setPin, child: Text(s.t('save'))),
            TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Skip')),
          ],
          if (busy) const Padding(padding: EdgeInsets.only(top: 16), child: Center(child: CircularProgressIndicator())),
        ]),
      ),
    );
  }

  Widget _digits(TextEditingController c, int n, {bool obscure = false}) => TextField(
        controller: c,
        keyboardType: TextInputType.number,
        obscureText: obscure,
        maxLength: n,
        autofocus: true,
        textAlign: TextAlign.center,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: 28, letterSpacing: 10, fontWeight: FontWeight.w700),
        decoration: const InputDecoration(counterText: ''),
      );
}
