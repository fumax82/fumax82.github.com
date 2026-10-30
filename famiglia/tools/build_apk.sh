#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# build_apk.sh - Crea l'APK firmato di Famiglia SENZA Android Studio.
#
# Serve solo: Java 17+ (javac), Python 3, Node.js (per i test), curl.
# Gli strumenti Android necessari vengono scaricati la prima volta in
# .build-tools/ (circa 28 MB):
#   - android.jar (API 34)      -> per compilare il codice Java
#   - dalvik-dx 16.0.1          -> converte il Java nel formato Android (.dex)
#   - apksig 2.3.0              -> firma l'APK
#
# Firma: usa keystore/famiglia-release.p12 con la password in
# keystore/password.txt. CONSERVA QUESTI DUE FILE: per installare un
# aggiornamento sopra l'app esistente serve SEMPRE la stessa firma.
#
# Uso:  bash tools/build_apk.sh        (dalla cartella famiglia/)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
TOOLS=$ROOT/.build-tools
BUILD=$ROOT/build
VERSION=$(grep -o 'android:versionName="[^"]*"' android/AndroidManifest.xml | cut -d'"' -f2)
OUT=$ROOT/dist/Famiglia-$VERSION.apk
mkdir -p "$TOOLS" "$ROOT/dist"
rm -rf "$BUILD" && mkdir -p "$BUILD/classes"

step() { echo; echo "==> $*"; }
fetch() { [ -s "$TOOLS/$1" ] || { echo "Scarico $1"; curl -fsSL -o "$TOOLS/$1" "$2"; }; }

step "1/7 Strumenti"
fetch android.jar   https://raw.githubusercontent.com/Sable/android-platforms/master/android-34/android.jar
fetch dalvik-dx.jar https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
fetch apksig.jar    https://repo1.maven.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar

step "2/7 Test della logica JavaScript"
if command -v node >/dev/null; then node --test tests/*.test.js; else echo "Node.js assente: test saltati"; fi

step "3/7 Compilazione Java"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -cp "$TOOLS/android.jar" -d "$BUILD/classes" android/java/it/famiglia/offline/*.java
# Android non ha LambdaMetafactory: nel codice niente lambda (usare classi anonime)
if for f in $(find "$BUILD/classes" -name '*.class'); do javap -c -p "$f" 2>/dev/null; done | grep -q invokedynamic; then
  echo "ERRORE: trovata una lambda (invokedynamic) nel codice Java. Sostituiscila con una classe anonima."; exit 1
fi

step "4/7 Conversione in classes.dex"
java -cp "$TOOLS/dalvik-dx.jar" com.android.dx.command.Main --dex --min-sdk-version=26 --output="$BUILD/classes.dex" "$BUILD/classes"

step "5/7 Manifest binario"
python3 tools/axml.py android/AndroidManifest.xml "$BUILD/AndroidManifest.xml"

step "6/7 Pacchetto APK (interfaccia da www/)"
python3 tools/package_apk.py "$BUILD/unsigned.apk" "$BUILD/AndroidManifest.xml" "$BUILD/classes.dex" android/res-compiled www

step "7/7 Firma"
KEYSTORE=${FAMIGLIA_KEYSTORE:-$ROOT/keystore/famiglia-release.p12}
PASSFILE=${FAMIGLIA_KEYSTORE_PASSWORD_FILE:-$ROOT/keystore/password.txt}
if [ ! -f "$KEYSTORE" ]; then
  echo "Nessuna chiave di firma trovata: ne creo una nuova in keystore/ (CONSERVALA!)"
  mkdir -p "$(dirname "$KEYSTORE")"
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$PASSFILE"
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -storepass "$(cat "$PASSFILE")" -keypass "$(cat "$PASSFILE")" \
    -alias famiglia -keyalg RSA -keysize 3072 -validity 12000 -dname "CN=Famiglia, O=Famiglia personale, C=IT"
fi
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$BUILD" tools/Sign.java
rm -f "$OUT"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED \
     --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$TOOLS/apksig.jar:$BUILD" \
     Sign "$KEYSTORE" "$(cat "$PASSFILE")" "$BUILD/unsigned.apk" "$OUT"
echo; echo "Fatto: $OUT ($(du -h "$OUT" | cut -f1))"
