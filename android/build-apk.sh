#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-/usr/local/lib/android/sdk}"
BUILD_TOOLS="${BUILD_TOOLS:-$SDK/build-tools/35.0.1}"
PLATFORM="${PLATFORM:-$SDK/platforms/android-35/android.jar}"
BUILD="$HERE/build"
WWW="$BUILD/assets/www"
DEX="$BUILD/dex"
CLASSES="$BUILD/classes"
KEYSTORE="$HERE/thomcall.jks"
VERSION="1.1.0"

for tool in "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/d8" "$BUILD_TOOLS/zipalign" "$BUILD_TOOLS/apksigner"; do
  if [ ! -x "$tool" ]; then
    echo "Ferramenta ausente: $tool" >&2
    exit 1
  fi
done
if [ ! -f "$PLATFORM" ]; then
  echo "android.jar ausente: $PLATFORM" >&2
  exit 1
fi

rm -rf "$BUILD"
mkdir -p "$WWW" "$DEX" "$CLASSES"

cp "$ROOT/index.html" "$ROOT/styles.css" "$WWW/"
cp -R "$ROOT/js" "$WWW/js"
cp -R "$ROOT/assets" "$WWW/assets"

"$BUILD_TOOLS/aapt2" link \
  -o "$BUILD/app-unsigned.apk" \
  -I "$PLATFORM" \
  --manifest "$HERE/AndroidManifest.xml" \
  -A "$BUILD/assets" \
  --auto-add-overlay

find "$HERE/src" -name '*.java' -print0 | xargs -0 javac \
  -encoding UTF-8 \
  -source 8 \
  -target 8 \
  -bootclasspath "$PLATFORM" \
  -d "$CLASSES"

find "$CLASSES" -name '*.class' -print0 | xargs -0 "$BUILD_TOOLS/d8" \
  --lib "$PLATFORM" \
  --min-api 23 \
  --output "$DEX"

(
  cd "$DEX"
  zip -q "$BUILD/app-unsigned.apk" classes.dex
)

"$BUILD_TOOLS/zipalign" -f 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass thomcall \
    -keypass thomcall \
    -alias thomcall \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Thom Call, O=Thom Call, C=BR" \
    -noprompt >/dev/null
fi

"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:thomcall \
  --key-pass pass:thomcall \
  --out "$BUILD/ThomCall-$VERSION.apk" \
  "$BUILD/app-aligned.apk"

"$BUILD_TOOLS/apksigner" verify --verbose "$BUILD/ThomCall-$VERSION.apk"
"$BUILD_TOOLS/aapt" dump badging "$BUILD/ThomCall-$VERSION.apk" | head -5
ls -lh "$BUILD/ThomCall-$VERSION.apk"
