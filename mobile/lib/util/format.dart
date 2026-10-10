/// Formatting helpers (no intl dependency, keeps the APK small).
String mwk(num? n) {
  if (n == null) return '';
  final s = n.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return 'MWK $buf';
}

String initials(String name) =>
    name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();

/// +265991234567 -> 0991 234 567 (masked numbers pass through unchanged).
String localPhone(String? e164) {
  if (e164 == null || e164.isEmpty) return '';
  final l = e164.replaceFirst('+265', '0');
  if (l.contains('xxx') || l.length != 10) return l;
  return '${l.substring(0, 4)} ${l.substring(4, 7)} ${l.substring(7)}';
}

/// Accepts 0991234567, 991234567, +265 99 123 4567. Returns null if not an Airtel/TNM number.
String? normalizeMwPhone(String input) {
  final d = input.replaceAll(RegExp(r'\D'), '');
  String local;
  if (d.startsWith('265') && d.length == 12) {
    local = d.substring(3);
  } else if (d.startsWith('0') && d.length == 10) {
    local = d.substring(1);
  } else if (d.length == 9) {
    local = d;
  } else {
    return null;
  }
  if (!RegExp(r'^(99|98|88|89)\d{7}$').hasMatch(local)) return null;
  return '+265$local';
}

String walletName(String? op) => op == 'airtel' ? 'Airtel Money' : 'TNM Mpamba';

String? timeLeft(String? iso) {
  if (iso == null) return null;
  final diff = DateTime.parse(iso).difference(DateTime.now());
  if (diff.isNegative) return null;
  final h = diff.inHours;
  final m = diff.inMinutes % 60;
  return h > 0 ? '$h h $m min' : '$m min';
}

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

String dateLabel(String? iso) {
  if (iso == null) return '';
  final d = DateTime.parse(iso);
  return '${_days[d.weekday - 1]} ${d.day} ${_months[d.month - 1]}';
}

String dateTimeLabel(String? iso) {
  if (iso == null) return '';
  final d = DateTime.parse(iso).toLocal();
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${_months[d.month - 1]}, $hh:$mm';
}

String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
