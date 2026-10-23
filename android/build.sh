#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$ROOT/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BUILD_TOOLS="${BUILD_TOOLS:-$SDK/build-tools/35.0.0}"
PLATFORM="${PLATFORM:-$SDK/platforms/android-35/android.jar}"
BUILD="$ROOT/build"
OUT="$APP_ROOT/dist"
KS="$ROOT/keystore/debug.keystore"

for tool in aapt2 aapt d8 zipalign apksigner; do
  if [ ! -x "$BUILD_TOOLS/$tool" ]; then
    echo "Missing Android build tool: $BUILD_TOOLS/$tool" >&2
    exit 1
  fi
done
if [ ! -f "$PLATFORM" ]; then
  echo "Missing Android platform: $PLATFORM" >&2
  exit 1
fi

echo "==> Cleaning"
rm -rf "$BUILD"
mkdir -p "$BUILD/assets/www" "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$OUT"

echo "==> Bundling web app"
for file in index.html styles.css app.js data.js engine.js favicon.svg overlay.html overlay.css overlay.js; do
  cp "$APP_ROOT/$file" "$BUILD/assets/www/$file"
done

echo "==> Compiling resources"
"$BUILD_TOOLS/aapt2" compile --dir "$ROOT/res" -o "$BUILD/res.zip"
"$BUILD_TOOLS/aapt2" link \
  -o "$BUILD/base-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$ROOT/AndroidManifest.xml" \
  -A "$BUILD/assets" \
  -R "$BUILD/res.zip" \
  --java "$BUILD/gen" \
  --auto-add-overlay

echo "==> Compiling Java"
find "$ROOT/java" "$BUILD/gen" -name '*.java' -print > "$BUILD/sources.txt"
javac \
  -source 11 \
  -target 11 \
  -Xlint:-options \
  -classpath "$PLATFORM" \
  -d "$BUILD/classes" \
  @"$BUILD/sources.txt"

echo "==> Dexing"
find "$BUILD/classes" -name '*.class' -print > "$BUILD/classes.txt"
"$BUILD_TOOLS/d8" \
  --lib "$PLATFORM" \
  --min-api 26 \
  --output "$BUILD/dex" \
  @"$BUILD/classes.txt"

echo "==> Packaging"
cp "$BUILD/base-unsigned.apk" "$BUILD/unsigned.apk"
zip -q -j "$BUILD/unsigned.apk" "$BUILD/dex/classes.dex"
"$BUILD_TOOLS/zipalign" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [ ! -f "$KS" ]; then
  echo "==> Creating debug keystore"
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair \
    -keystore "$KS" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" \
    >/dev/null 2>&1
fi

echo "==> Signing"
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KS" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --ks-key-alias androiddebugkey \
  --out "$OUT/onmyoji-live-coach.apk" \
  "$BUILD/aligned.apk"

echo "==> Verifying"
"$BUILD_TOOLS/apksigner" verify --verbose "$OUT/onmyoji-live-coach.apk"
"$BUILD_TOOLS/aapt" dump badging "$OUT/onmyoji-live-coach.apk" | sed -n '1,8p'

echo
echo "APK: $OUT/onmyoji-live-coach.apk"
ls -lh "$OUT/onmyoji-live-coach.apk"
