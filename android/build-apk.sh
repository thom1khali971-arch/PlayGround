#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-/usr/local/lib/android/sdk}"
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-34/android.jar"
KEYSTORE="${SHIKIGAMI_KEYSTORE:-/tmp/shikigami-forge.keystore}"
STOREPASS="${SHIKIGAMI_STOREPASS:-shikigami2026}"

mkdir -p "$ROOT/android/assets/www/assets"
cp "$ROOT/index.html" "$ROOT/android/assets/www/index.html"
cp "$ROOT/assets/styles.css" "$ROOT/assets/data.js" "$ROOT/assets/app.js" "$ROOT/android/assets/www/assets/"

rm -rf "$ROOT/android/build"
mkdir -p "$ROOT/android/build/compiled" "$ROOT/android/build/gen" "$ROOT/android/build/classes" "$ROOT/android/build/dex"

"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$ROOT/android/build/compiled"
"$BT/aapt2" link \
  -o "$ROOT/android/build/base.apk" \
  -I "$JAR" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  -R "$ROOT/android/build/compiled"/*.flat \
  -A "$ROOT/android/assets" \
  --java "$ROOT/android/build/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name 1.0.0 \
  --auto-add-overlay

javac -source 8 -target 8 -bootclasspath "$JAR" -d "$ROOT/android/build/classes" \
  "$ROOT/android/build/gen/com/shikigamiforge/app/R.java" \
  "$ROOT/android/src/com/shikigamiforge/app/MainActivity.java"

find "$ROOT/android/build/classes" -name '*.class' > "$ROOT/android/build/classes.txt"
"$BT/d8" --lib "$JAR" --min-api 24 --output "$ROOT/android/build/dex" $(cat "$ROOT/android/build/classes.txt")
( cd "$ROOT/android/build/dex" && zip -q ../base.apk classes.dex )
"$BT/zipalign" -f 4 "$ROOT/android/build/base.apk" "$ROOT/android/build/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -alias shikigami -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Shikigami Forge, OU=Fan Project, O=Shikigami Forge, L=Sao Paulo, ST=SP, C=BR" \
    -noprompt
fi

mkdir -p "$ROOT/downloads"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias shikigami \
  --ks-pass "pass:$STOREPASS" --key-pass "pass:$STOREPASS" \
  --v4-signing-enabled false \
  --out "$ROOT/downloads/shikigami-forge.apk" "$ROOT/android/build/aligned.apk"
"$BT/apksigner" verify --verbose "$ROOT/downloads/shikigami-forge.apk" | head -10
