import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'screens/account_screen.dart';
import 'screens/bookings_screen.dart';
import 'screens/home_screen.dart';
import 'screens/language_screen.dart';
import 'screens/provider/dashboard_screen.dart';
import 'state/app_state.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final state = AppState(Api())..init();
  runApp(ChangeNotifierProvider.value(value: state, child: const FundiApp()));
}

class FundiApp extends StatelessWidget {
  const FundiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fundi',
      debugShowCheckedModeBanner: false,
      theme: fundiTheme(),
      // Respect the phone's text size setting but cap it so layouts stay usable.
      builder: (context, child) {
        final mq = MediaQuery.of(context);
        return MediaQuery(
          data: mq.copyWith(textScaler: mq.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.4)),
          child: child!,
        );
      },
      home: const Root(),
    );
  }
}

class Root extends StatelessWidget {
  const Root({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (!s.ready) {
      return const Scaffold(
        body: Center(
          child: Text('fundi', style: TextStyle(fontSize: 44, fontWeight: FontWeight.w700, color: FundiColors.green)),
        ),
      );
    }
    if (!s.languageChosen) return const LanguageScreen();
    return const Shell();
  }
}

/// Bottom-tab shell. Customers see Home / Bookings / Account; in fundi mode the first tab is Jobs.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final pages = [
      s.providerMode ? const ProviderDashboardScreen() : const HomeScreen(),
      BookingsScreen(asProvider: s.providerMode),
      const AccountScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: [
          NavigationDestination(
            icon: Icon(s.providerMode ? Icons.work_outline : Icons.home_outlined),
            selectedIcon: Icon(s.providerMode ? Icons.work : Icons.home),
            label: s.providerMode ? s.t('tab_jobs') : s.t('tab_home'),
          ),
          NavigationDestination(icon: const Icon(Icons.event_note_outlined), selectedIcon: const Icon(Icons.event_note), label: s.t('tab_bookings')),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: s.t('tab_account')),
        ],
      ),
    );
  }
}
