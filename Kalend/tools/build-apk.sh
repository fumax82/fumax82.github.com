#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# COSTRUISCE L'APK DI PROVA CON IL NUOVO NATIVO, SENZA L'SDK ANDROID.
#
# Android Studio non è disponibile in questo ambiente, quindi si usano i
# due strumenti essenziali scaricati dalle fonti ufficiali:
#   · d8 (compilatore dex) dal bucket di rilascio di R8 di Google
#   · aapt2 (compilatore delle risorse) estratto dal jar di Apktool
# e, come "android.jar", il jar android-all di Robolectric (API 36).
#
# Passi: risorse → base.apk (aapt2) · R.java vera → javac → d8 → classes.dex
#        → zip allineato con assets/www → firma v2 di PROVA (sign-apk.py).
# Risultato: dist/Kalend-native-test-signed.apk (SOLO per prove: la firma
# è quella di prova, per il negozio serve l'AAB firmato da Android Studio).
# Uso: Kalend/tools/build-apk.sh   (prima: node tools/build.js)
# ══════════════════════════════════════════════════════════════════
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/android-src/app/src/main"
CACHE="${KALEND_SDK_CACHE:-/tmp/kalend-sdk-cache}"
JAR="$CACHE/android-all-16.jar"
R8="$CACHE/r8lib.jar"
AAPT2="$CACHE/aapt2"
WORK="$CACHE/apk-build"
VERSION_CODE=55; VERSION_NAME="55.0"
CONTACT="${KALEND_CONTACT:-https://github.com/fumax82/fumax82.github.com}"
mkdir -p "$CACHE"

# ── strumenti ──
if [ ! -s "$JAR" ]; then
  echo "scarico android-all (API 36) da Maven Central…"
  curl -sSL -o "$JAR" "https://repo1.maven.org/maven2/org/robolectric/android-all/16-robolectric-13921718/android-all-16-robolectric-13921718.jar"
fi
if [ ! -s "$R8" ]; then
  echo "scarico d8/r8 8.5.35 dal bucket ufficiale di Google…"
  curl -sSL -o "$R8" "https://storage.googleapis.com/r8-releases/raw/8.5.35/r8lib.jar"
fi
if [ ! -x "$AAPT2" ]; then
  echo "scarico Apktool 2.10.0 (GitHub) per estrarne aapt2…"
  curl -sSL -o "$CACHE/apktool.jar" "https://github.com/iBotPeaches/Apktool/releases/download/v2.10.0/apktool_2.10.0.jar"
  unzip -o -q "$CACHE/apktool.jar" 'prebuilt/linux/aapt2_64' -d "$CACHE/apktool-x"
  cp "$CACHE/apktool-x/prebuilt/linux/aapt2_64" "$AAPT2" && chmod +x "$AAPT2"
fi
[ -s "$ROOT/www/index.html" ] || { echo "manca www/index.html: esegui prima  node tools/build.js"; exit 1; }

rm -rf "$WORK"; mkdir -p "$WORK/assets/www" "$WORK/gen" "$WORK/classes" "$WORK/dex"

# ── 1. asset: la pagina costruita e i dati (atlante città) ──
cp "$ROOT/www/index.html" "$WORK/assets/www/"
[ -d "$ROOT/www/data" ] && cp -r "$ROOT/www/data" "$WORK/assets/www/data"

# ── 2. manifest: Gradle aggiunge da sé package/versione; qui li mettiamo noi ──
sed "s#<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\">#<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\" package=\"app.kalend\" android:versionCode=\"$VERSION_CODE\" android:versionName=\"$VERSION_NAME\">#" \
  "$SRC/AndroidManifest.xml" > "$WORK/AndroidManifest.xml"
grep -q 'package="app.kalend"' "$WORK/AndroidManifest.xml" || { echo "manifest: riga <manifest> non riconosciuta"; exit 1; }

# ── 3. risorse → base.apk + R.java vera ──
"$AAPT2" compile --dir "$SRC/res" -o "$WORK/res.zip"
"$AAPT2" link -o "$WORK/base.apk" -I "$JAR" --manifest "$WORK/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 36 --java "$WORK/gen" -A "$WORK/assets" --auto-add-overlay "$WORK/res.zip"

# ── 4. BuildConfig (Gradle la genera da sé) ──
mkdir -p "$WORK/gen/app/kalend"
cat > "$WORK/gen/app/kalend/BuildConfig.java" <<JAVA
package app.kalend;
public final class BuildConfig {
  public static final boolean DEBUG = false;
  public static final String APPLICATION_ID = "app.kalend";
  public static final int VERSION_CODE = $VERSION_CODE;
  public static final String VERSION_NAME = "$VERSION_NAME";
  public static final String CONTACT = "$CONTACT";
}
JAVA

# ── 5. Java → class → dex ──
javac -nowarn -Xlint:none -encoding UTF-8 --release 17 -cp "$JAR" -d "$WORK/classes" $(find "$SRC/java" "$WORK/gen" -name '*.java') 2>&1 | grep -v JAVA_TOOL_OPTIONS || true
[ -s "$WORK/classes/app/kalend/MainActivity.class" ] || { echo "ERRORE: javac non ha prodotto le classi"; exit 1; }
jar cf "$WORK/classes.jar" -C "$WORK/classes" .
java -cp "$R8" com.android.tools.r8.D8 --release --min-api 24 --lib "$JAR" --output "$WORK/dex" "$WORK/classes.jar" 2>&1 | grep -v JAVA_TOOL_OPTIONS || true
[ -s "$WORK/dex/classes.dex" ] || { echo "ERRORE: d8 non ha prodotto classes.dex"; exit 1; }

# ── 6. APK finale: base.apk + classes.dex, resources.arsc non compresso e allineato ──
mkdir -p "$ROOT/dist"
python3 - "$WORK/base.apk" "$WORK/dex/classes.dex" "$ROOT/dist/Kalend-native-unsigned.apk" <<'PY'
import struct, sys, zipfile
base, dex, out = sys.argv[1:4]
with zipfile.ZipFile(base) as src, zipfile.ZipFile(out, 'w') as dst:
    def put(name, data, method, date_time=(2026, 1, 1, 0, 0, 0)):
        ni = zipfile.ZipInfo(name, date_time=date_time)
        ni.compress_type = method
        if method == zipfile.ZIP_STORED:          # allineamento a 4 byte (come zipalign -p 4)
            pos = dst.fp.tell()
            pad = (-(pos + 30 + len(name.encode('utf-8')))) % 4
            if pad:
                while pad < 4: pad += 4
                ni.extra = struct.pack('<HH', 0xd935, pad - 4) + b'\x00' * (pad - 4)
        dst.writestr(ni, data)
    put('classes.dex', open(dex, 'rb').read(), zipfile.ZIP_DEFLATED)
    for info in src.infolist():
        n = info.filename
        if n.startswith('META-INF/'): continue
        stored = n == 'resources.arsc' or n.endswith(('.png', '.webp', '.ogg', '.mp3'))
        put(n, src.read(n), zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED, info.date_time)
print('APK non firmato:', out)
PY

# ── 7. firma di prova (schema v2) ──
python3 "$ROOT/tools/sign-apk.py" "$ROOT/dist/Kalend-native-unsigned.apk" --out "$ROOT/dist/Kalend-native-test-signed.apk" | tail -2
echo "── contenuto ──"
"$AAPT2" dump badging "$ROOT/dist/Kalend-native-test-signed.apk" | grep -E '^(package|sdkVersion|targetSdkVersion|application-label:|launchable)' | cut -c1-120
