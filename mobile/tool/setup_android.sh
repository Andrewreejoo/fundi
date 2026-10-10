#!/usr/bin/env bash
# Generates the Android project files (flutter create) without touching lib/, then adds the
# permissions and intent queries Fundi needs. Run once after cloning, and in CI before building.
#   cd mobile && ./tool/setup_android.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f android/app/src/main/AndroidManifest.xml ]; then
  flutter create --platforms=android --org mw.fundi --project-name fundi .
  rm -f test/widget_test.dart # template test refers to the counter app
fi

MANIFEST=android/app/src/main/AndroidManifest.xml
python3 - "$MANIFEST" <<'PY'
import re, sys
path = sys.argv[1]
s = open(path).read()
perms = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION',
]
for p in perms:
    if p not in s:
        s = s.replace('<application', f'<uses-permission android:name="{p}"/>\n    <application', 1)
# App name shown under the icon
s = re.sub(r'android:label="[^"]*"', 'android:label="Fundi"', s, count=1)
# Android 11+ needs <queries> for tel: links (Call button) and opening web pages.
if '<data android:scheme="tel"' not in s:
    q = '''
        <intent>
            <action android:name="android.intent.action.DIAL"/>
            <data android:scheme="tel"/>
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW"/>
            <data android:scheme="https"/>
        </intent>'''
    if '<queries>' in s:
        s = s.replace('<queries>', '<queries>' + q, 1)
    else:
        s = s.replace('</manifest>', f'    <queries>{q}\n    </queries>\n</manifest>', 1)
open(path, 'w').write(s)
print('AndroidManifest patched')
PY

# Debug builds only: allow plain http so the app can reach an API on your laptop (http://10.0.2.2:3000).
# Release builds keep Android's default and need an https API_URL.
DEBUG_MANIFEST=android/app/src/debug/AndroidManifest.xml
if [ -f "$DEBUG_MANIFEST" ] && ! grep -q usesCleartextTraffic "$DEBUG_MANIFEST"; then
  sed -i.bak 's#</manifest>#    <application android:usesCleartextTraffic="true"/>\n</manifest>#' "$DEBUG_MANIFEST" && rm -f "$DEBUG_MANIFEST.bak"
fi
