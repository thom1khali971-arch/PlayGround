#!/usr/bin/env bash
# Gera o APK Android (WebView) a partir de dist/index.html.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/android"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/36.0.0"
[ -d "$BT" ] || BT="$(ls -d "$SDK"/build-tools/* | sort -V | tail -1)"
PLATFORM="$SDK/platforms/android-34/android.jar"
[ -f "$PLATFORM" ] || PLATFORM="$SDK/platforms/android-35/android.jar"

OUT=build
rm -rf "$OUT"
mkdir -p "$OUT/compiled" "$OUT/gen" "$OUT/classes" "$OUT/dex" assets

cp "$ROOT/dist/index.html" assets/index.html
cp "$ROOT/dist/rock-paper-clash.html" assets/rock-paper-clash.html
mkdir -p assets/assets
cp -a "$ROOT/assets/." assets/assets/

"$BT/aapt2" compile --dir res -o "$OUT/compiled/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLATFORM" \
  --manifest AndroidManifest.xml -A assets --java "$OUT/gen" \
  --min-sdk-version 23 --target-sdk-version 34 "$OUT/compiled/res.zip"

javac --release 11 -classpath "$PLATFORM" -d "$OUT/classes" \
  java/com/thomkhali/pxt/MainActivity.java "$OUT/gen/com/thomkhali/pxt/R.java"

find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8" --lib "$PLATFORM" --min-api 23 --output "$OUT/dex" $(cat "$OUT/classes.txt")

(cd "$OUT" && zip -uj base.apk dex/classes.dex >/dev/null)
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

KS=keystore/pxt-release.keystore
PASS="${PXT_KEYSTORE_PASS:-pxt2026}"
if [ ! -f "$KS" ]; then
  mkdir -p keystore
  keytool -genkeypair -keystore "$KS" -storetype JKS -alias pxt \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Thom Khali, O=PXT, C=BR" \
    -keyalg RSA -keysize 2048 -validity 10000 >/dev/null
fi

"$BT/apksigner" sign --ks "$KS" --ks-key-alias pxt \
  --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out "$OUT/PXT-1.0.apk" "$OUT/aligned.apk"

"$BT/apksigner" verify --verbose "$OUT/PXT-1.0.apk" | head -5
mkdir -p "$ROOT/dist/android"
cp "$OUT/PXT-1.0.apk" "$ROOT/dist/android/PXT-1.0.apk"
echo "APK: $ROOT/dist/android/PXT-1.0.apk"
