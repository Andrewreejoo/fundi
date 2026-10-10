import 'package:flutter_test/flutter_test.dart';
import 'package:fundi/l10n/strings.dart';
import 'package:fundi/util/format.dart';

void main() {
  group('mwk', () {
    test('groups thousands', () {
      expect(mwk(15300), 'MWK 15,300');
      expect(mwk(1000000), 'MWK 1,000,000');
      expect(mwk(200), 'MWK 200');
      expect(mwk(null), '');
    });
  });

  group('phone numbers', () {
    test('normalizes Airtel and TNM numbers', () {
      expect(normalizeMwPhone('0991234567'), '+265991234567');
      expect(normalizeMwPhone('+265 88 123 4567'), '+265881234567');
      expect(normalizeMwPhone('991234567'), '+265991234567');
    });
    test('rejects other numbers', () {
      expect(normalizeMwPhone('0712345678'), isNull);
      expect(normalizeMwPhone('12345'), isNull);
    });
    test('formats for display and keeps masked numbers', () {
      expect(localPhone('+265991234567'), '0991 234 567');
      expect(localPhone('0991 xxx 567'), '0991 xxx 567');
    });
  });

  test('initials', () {
    expect(initials('Chikondi Phiri'), 'CP');
    expect(initials('grace'), 'G');
  });

  test('strings fall back to English', () {
    expect(tr(Lang.ny, 'book'), 'Bukani');
    expect(tr(Lang.en, 'book'), 'Book');
    expect(tr(Lang.ny, 'missing_key'), 'missing_key');
  });
}
