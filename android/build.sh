#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT must point to the Android SDK." >&2
  exit 1
fi

BT="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
PLATFORM="$(find "$SDK/platforms" -mindepth 1 -maxdepth 1 -type d -name 'android-*' | sort -V | tail -1)/android.jar"
OUT="build"
APK="ThomLol-pin-275480.apk"
KS="release.keystore"
KS_PASS="thomlol2026"

rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/compiled/res.zip"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest AndroidManifest.xml \
  -R "$OUT/compiled/res.zip" \
  -A assets \
  --auto-add-overlay

javac -source 8 -target 8 -bootclasspath "$PLATFORM" -d "$OUT/classes" \
  $(find src -name '*.java')

"$BT/d8" --release --min-api 24 --lib "$PLATFORM" \
  --output "$OUT/dex" "$OUT"/classes/com/thomlol/app/*.class

cp "$OUT/base.apk" "$OUT/withdex.apk"
python3 - "$OUT/withdex.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, "a", zipfile.ZIP_DEFLATED) as z:
    z.write(dex, "classes.dex")
PY

"$BT/zipalign" -f -p 4 "$OUT/withdex.apk" "$OUT/aligned.apk"

if [[ ! -f "$KS" ]]; then
  keytool -genkeypair -keystore "$KS" \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -alias thomlol \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Thom.Lol, OU=Android, O=Thom.Lol, L=Sao Paulo, ST=SP, C=BR" >/dev/null
fi

"$BT/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$APK" "$OUT/aligned.apk"

"$BT/apksigner" verify "$APK"
cp "$APK" ../"$APK"
echo "Built $APK"
