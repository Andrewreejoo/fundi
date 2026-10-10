import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/strings.dart';
import '../state/app_state.dart';
import '../ui/theme.dart';

/// First launch: pick Chichewa or English with two big buttons.
class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Spacer(),
            const Text('fundi', textAlign: TextAlign.center, style: TextStyle(fontSize: 52, fontWeight: FontWeight.w700, color: FundiColors.green)),
            const SizedBox(height: 8),
            Text(tr(Lang.ny, 'app_tagline'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 18)),
            Text(tr(Lang.en, 'app_tagline'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, color: FundiColors.muted)),
            const Spacer(),
            Text('${tr(Lang.ny, 'choose_language')} · ${tr(Lang.en, 'choose_language')}',
                textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => s.setLang(Lang.ny), child: const Text('Chichewa')),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: () => s.setLang(Lang.en), child: const Text('English')),
            const SizedBox(height: 32),
          ]),
        ),
      ),
    );
  }
}
