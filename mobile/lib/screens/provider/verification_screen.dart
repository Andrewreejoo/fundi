import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

/// National ID photo + live selfie, uploaded as private files and reviewed by an admin (spec 2.3).
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  File? idPhoto;
  File? selfie;
  bool busy = false;

  Future<File?> _take(CameraDevice cam) async {
    final x = await ImagePicker().pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: cam,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 75,
    );
    return x == null ? null : File(x.path);
  }

  Future<void> _submit() async {
    final s = context.read<AppState>();
    setState(() => busy = true);
    try {
      final id = await s.api.upload(idPhoto!, private: true);
      final sf = await s.api.upload(selfie!, private: true);
      await s.api.post('/providers/me/verification', {'idFileId': id['id'], 'selfieFileId': sf['id']});
      if (!mounted) return;
      showInfo(context, 'Sent. We will SMS you when your ID is checked.');
      Navigator.of(context).pop(true);
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
      appBar: AppBar(title: Text(s.t('verify_id'))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Verified fundis get a tick, rank higher in search and can take bigger escrow jobs. '
            'Your photos are private: only our verification team sees them, and they are deleted 90 days after the check.'),
        const SizedBox(height: 20),
        _shot('1. Photo of your national ID', idPhoto, Icons.badge_outlined, () async {
          final f = await _take(CameraDevice.rear);
          if (f != null) setState(() => idPhoto = f);
        }),
        const SizedBox(height: 14),
        _shot('2. A selfie, face clearly visible', selfie, Icons.face_outlined, () async {
          final f = await _take(CameraDevice.front);
          if (f != null) setState(() => selfie = f);
        }),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: idPhoto != null && selfie != null && !busy ? _submit : null,
          child: busy ? const CircularProgressIndicator(color: Colors.white) : const Text('Send for checking'),
        ),
      ]),
    );
  }

  Widget _shot(String label, File? file, IconData icon, VoidCallback onTap) => Card(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              file != null
                  ? ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(file, width: 72, height: 72, fit: BoxFit.cover))
                  : Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(color: FundiColors.sunk, borderRadius: BorderRadius.circular(8)),
                      child: Icon(icon, size: 34, color: FundiColors.muted),
                    ),
              const SizedBox(width: 14),
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              Icon(file != null ? Icons.check_circle : Icons.photo_camera_outlined, color: FundiColors.green),
            ]),
          ),
        ),
      );
}
