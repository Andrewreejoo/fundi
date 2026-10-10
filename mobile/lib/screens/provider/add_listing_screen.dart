import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../state/app_state.dart';
import '../../ui/theme.dart';
import '../../ui/widgets.dart';

class AddListingScreen extends StatefulWidget {
  const AddListingScreen({super.key, required this.trades});
  final List<Map<String, dynamic>> trades;

  @override
  State<AddListingScreen> createState() => _AddListingScreenState();
}

class _AddListingScreenState extends State<AddListingScreen> {
  late int categoryId = widget.trades.first['id'] as int;
  String priceType = 'fixed';
  final title = TextEditingController();
  final description = TextEditingController();
  final price = TextEditingController();
  final photos = <File>[];
  bool busy = false;

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    price.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    // Resize on the phone: max 1280 px, 70% quality keeps uploads small on 2G/3G (spec 5.5).
    final x = await ImagePicker().pickImage(source: source, maxWidth: 1280, maxHeight: 1280, imageQuality: 70);
    if (x != null) setState(() => photos.add(File(x.path)));
  }

  Future<void> _save() async {
    final s = context.read<AppState>();
    if (title.text.trim().length < 3) {
      showError(context, 'Enter a service name');
      return;
    }
    if (priceType != 'quote' && (int.tryParse(price.text) ?? 0) < 100) {
      showError(context, 'Enter a price');
      return;
    }
    setState(() => busy = true);
    try {
      final ids = <String>[];
      for (final f in photos) {
        ids.add((await s.api.upload(f))['id'] as String);
      }
      await s.api.post('/providers/me/listings', {
        'categoryId': categoryId,
        'title': title.text.trim(),
        if (description.text.trim().isNotEmpty) 'description': description.text.trim(),
        'priceType': priceType,
        if (priceType != 'quote') 'priceMwk': int.parse(price.text),
        'photoIds': ids,
      });
      if (mounted) Navigator.of(context).pop(true);
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
      appBar: AppBar(title: Text(s.t('add_service'))),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        if (widget.trades.length > 1)
          DropdownButtonFormField<int>(
            initialValue: categoryId,
            items: [for (final c in widget.trades) DropdownMenuItem(value: c['id'] as int, child: Text(s.catName(c)))],
            onChanged: (v) => setState(() => categoryId = v!),
          ),
        const SizedBox(height: 12),
        TextField(controller: title, decoration: const InputDecoration(labelText: 'Service name', hintText: 'e.g. Toilet fitting')),
        const SizedBox(height: 12),
        TextField(controller: description, maxLines: 3, decoration: const InputDecoration(labelText: 'Details (optional)')),
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
            decoration: InputDecoration(labelText: s.t('price_mwk')),
          ),
        ],
        const SizedBox(height: 16),
        const Text('Photos of your work', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final f in photos)
            ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(f, width: 84, height: 84, fit: BoxFit.cover)),
          if (photos.length < 6) ...[
            _photoButton(Icons.photo_camera_outlined, 'Camera', () => _addPhoto(ImageSource.camera)),
            _photoButton(Icons.photo_library_outlined, 'Gallery', () => _addPhoto(ImageSource.gallery)),
          ],
        ]),
        const SizedBox(height: 24),
        FilledButton(onPressed: busy ? null : _save, child: busy ? const CircularProgressIndicator(color: Colors.white) : Text(s.t('save'))),
      ]),
    );
  }

  Widget _photoButton(IconData icon, String label, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(border: Border.all(color: const Color(0xFFB8AE9C)), borderRadius: BorderRadius.circular(10)),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: FundiColors.green),
            Text(label, style: const TextStyle(fontSize: 12)),
          ]),
        ),
      );
}
