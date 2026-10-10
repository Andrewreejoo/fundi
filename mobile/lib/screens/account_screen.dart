import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/strings.dart';
import '../state/app_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import '../util/format.dart';
import 'login_screen.dart';
import 'provider/signup_wizard.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  Future<void> _editName(BuildContext context) async {
    final s = context.read<AppState>();
    final c = TextEditingController(text: s.user?['name'] as String? ?? '');
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Your name'),
        content: TextField(controller: c, autofocus: true, textCapitalization: TextCapitalization.words),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.t('cancel'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: Text(s.t('save'))),
        ],
      ),
    );
    if (name == null || name.length < 2) return;
    try {
      await s.api.patch('/me', {'name': name});
      await s.refreshMe();
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _setPin(BuildContext context) async {
    final s = context.read<AppState>();
    final c = TextEditingController();
    final pin = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(s.t('set_pin')),
        content: TextField(controller: c, autofocus: true, obscureText: true, maxLength: 4, keyboardType: TextInputType.number),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(s.t('cancel'))),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: Text(s.t('save'))),
        ],
      ),
    );
    if (pin == null) return;
    try {
      await s.api.post('/auth/pin', {'pin': pin});
      if (context.mounted) showInfo(context, 'PIN saved');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final u = s.user;
    return Scaffold(
      appBar: AppBar(title: Text(s.t('tab_account'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (u == null) ...[
          Text(s.t('app_tagline'), style: const TextStyle(fontSize: 18)),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => LoginScreen.ensure(context), child: Text(s.t('sign_in'))),
        ] else ...[
          Card(
            child: ListTile(
              minTileHeight: 64,
              leading: Avatar(name: (u['name'] as String?) ?? '?', size: 44),
              title: Text((u['name'] as String?) ?? 'Add your name', style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(localPhone(u['phone'] as String?)),
              trailing: const Icon(Icons.edit_outlined),
              onTap: () => _editName(context),
            ),
          ),
          const SizedBox(height: 12),
          if (s.isProvider)
            Card(
              child: SwitchListTile(
                value: s.providerMode,
                onChanged: s.setProviderMode,
                secondary: const Icon(Icons.handyman_outlined, color: FundiColors.green),
                title: Text(s.t('fundi_mode'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(s.providerMode ? 'Showing your jobs' : s.t('customer_mode')),
              ),
            )
          else
            Card(
              child: ListTile(
                minTileHeight: 64,
                leading: const Icon(Icons.handyman_outlined, color: FundiColors.green),
                title: Text(s.t('become_fundi'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Free. Get jobs near you and guaranteed payment.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignupWizard())),
              ),
            ),
          const SizedBox(height: 12),
          Card(
            child: Column(children: [
              ListTile(
                leading: const Icon(Icons.pin_outlined),
                title: Text((u['has_pin'] == true) ? 'Change PIN' : s.t('set_pin')),
                onTap: () => _setPin(context),
              ),
              ListTile(
                leading: const Icon(Icons.translate),
                title: Text(s.lang == Lang.ny ? 'English' : 'Chichewa'),
                onTap: () => s.setLang(s.lang == Lang.ny ? Lang.en : Lang.ny),
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: Text(s.t('sign_out')),
                onTap: () => s.signOut(),
              ),
            ]),
          ),
        ],
      ]),
    );
  }
}
