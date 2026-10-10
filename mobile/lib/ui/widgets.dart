import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/app_state.dart';
import '../util/format.dart';
import 'theme.dart';

/// Category icon names from the API mapped to Material icons.
IconData categoryIcon(String? name) {
  switch (name) {
    case 'droplet':
      return Icons.water_drop_outlined;
    case 'bolt':
      return Icons.bolt_outlined;
    case 'flame':
      return Icons.local_fire_department_outlined;
    case 'hammer':
      return Icons.handyman_outlined;
    case 'bricks':
      return Icons.foundation_outlined;
    case 'scissors':
      return Icons.content_cut;
    case 'comb':
      return Icons.face_retouching_natural_outlined;
    case 'car':
      return Icons.directions_car_outlined;
    case 'basket':
      return Icons.shopping_basket_outlined;
    case 'phone':
      return Icons.phone_android_outlined;
    default:
      return Icons.build_outlined;
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.fileId, this.size = 56});
  final String name;
  final String? fileId;
  final double size;

  @override
  Widget build(BuildContext context) {
    final api = context.read<AppState>().api;
    return ClipOval(
      child: Container(
        width: size,
        height: size,
        color: const Color(0xFFD9E7DE),
        alignment: Alignment.center,
        child: fileId != null
            ? Image.network(api.fileUrl(fileId!), width: size, height: size, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _initials())
            : _initials(),
      ),
    );
  }

  Widget _initials() => Text(initials(name),
      style: TextStyle(fontSize: size * 0.36, fontWeight: FontWeight.w700, color: FundiColors.green));
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.bg = FundiColors.sunk, this.fg = FundiColors.ink, this.icon});
  final String text;
  final Color bg;
  final Color fg;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 4)],
          Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: fg)),
        ]),
      );
}

class LevelBadge extends StatelessWidget {
  const LevelBadge(this.level, {super.key});
  final String? level;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    switch (level) {
      case 'trusted':
        return Pill(s.t('badge_trusted'), bg: FundiColors.goldTint, fg: FundiColors.gold, icon: Icons.star);
      case 'id_verified':
        return Pill(s.t('badge_id'), bg: FundiColors.greenTint, fg: FundiColors.green, icon: Icons.verified_outlined);
      default:
        return Pill(s.t('badge_basic'), fg: FundiColors.muted);
    }
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    final good = ['confirmed', 'paid'].contains(status);
    final bad = ['disputed', 'cancelled', 'expired'].contains(status);
    final warn = ['requested', 'quoted', 'accepted', 'completed'].contains(status);
    return Pill(
      s.t('st_$status'),
      bg: good ? FundiColors.greenTint : bad ? FundiColors.redTint : warn ? FundiColors.orangeTint : FundiColors.sunk,
      fg: good ? FundiColors.green : bad ? FundiColors.red : warn ? const Color(0xFF8A3409) : FundiColors.ink,
    );
  }
}

/// Plays a pre-recorded Chichewa prompt from assets/audio/<key>.mp3 (spec: voice for low literacy).
class ListenButton extends StatefulWidget {
  const ListenButton(this.audioKey, {super.key, this.big = false});
  final String audioKey;
  final bool big;

  @override
  State<ListenButton> createState() => _ListenButtonState();
}

class _ListenButtonState extends State<ListenButton> {
  final _player = AudioPlayer();
  bool _playing = false;

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _play() async {
    final s = context.read<AppState>();
    final messenger = ScaffoldMessenger.of(context);
    try {
      setState(() => _playing = true);
      await _player.play(AssetSource('audio/${widget.audioKey}.mp3'));
      _player.onPlayerComplete.first.then((_) {
        if (mounted) setState(() => _playing = false);
      });
    } catch (_) {
      if (mounted) setState(() => _playing = false);
      messenger.showSnackBar(SnackBar(content: Text(s.t('audio_soon'))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    final size = widget.big ? 88.0 : 48.0;
    return Semantics(
      button: true,
      label: s.t('listen'),
      child: InkWell(
        onTap: _play,
        customBorder: const CircleBorder(),
        child: Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(color: FundiColors.green, shape: BoxShape.circle),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(_playing ? Icons.graphic_eq : Icons.volume_up_outlined, color: Colors.white, size: widget.big ? 34 : 24),
            if (widget.big) Text(s.t('listen'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}

class ProviderCard extends StatelessWidget {
  const ProviderCard({super.key, required this.p, required this.onTap});
  final Map<String, dynamic> p;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    final rated = (p['rating_count'] as num? ?? 0) > 0;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Avatar(name: p['display_name'] as String, fileId: p['avatar_file_id'] as String?),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                        child: Text(p['display_name'] as String,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
                    if (p['distance_km'] != null) Text('${p['distance_km']} km', style: const TextStyle(color: FundiColors.muted)),
                  ]),
                  const SizedBox(height: 2),
                  Text(
                    rated ? '★ ${p['rating']} (${p['rating_count']} ${s.t('reviews')}) · ${p['area']}' : '${s.t('new_fundi')} · ${p['area']}',
                    style: const TextStyle(color: FundiColors.muted, fontSize: 14),
                  ),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    LevelBadge(p['verification_level'] as String?),
                    if (p['available_today'] == true) Pill(s.t('available_today'), bg: FundiColors.greenTint, fg: FundiColors.green),
                  ]),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: Text(
                  p['from_price_mwk'] != null ? '${s.t('from')} ${mwk(p['from_price_mwk'] as num)}' : s.t('ask_quote'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              const Icon(Icons.chevron_right, color: FundiColors.muted),
            ]),
          ]),
        ),
      ),
    );
  }
}

class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    if (!s.offline) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      color: const Color(0xFFFFF6E6),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(children: [
        const Icon(Icons.cloud_off, size: 18, color: FundiColors.gold),
        const SizedBox(width: 8),
        Expanded(child: Text(s.t('offline'), style: const TextStyle(color: FundiColors.gold, fontSize: 14))),
      ]),
    );
  }
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final s = context.read<AppState>();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(error is ApiException && (error as ApiException).isOffline ? Icons.cloud_off : Icons.error_outline,
              size: 48, color: FundiColors.muted),
          const SizedBox(height: 12),
          Text('$error', textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: Text(s.t('retry'))),
        ]),
      ),
    );
  }
}

void showError(BuildContext context, Object e) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: FundiColors.red));
}

void showInfo(BuildContext context, String msg) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
}
