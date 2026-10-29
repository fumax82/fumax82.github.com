#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# TEST AUTOMATICI DELLA PARTE NATIVA, senza l'SDK Android né un telefono.
#
# Cosa fa:
#  1. compila il codice Java dell'app (tools/native-check.sh, contro il jar
#     "android-all" con le classi vere di Android 16);
#  2. scarica da Maven Central JUnit 4, Hamcrest e org.json, controllando
#     l'impronta SHA-256 di ciascun file (se non corrisponde si ferma);
#  3. compila i test di android-src/app/src/test/java;
#  4. li esegue DUE volte:
#       · «come sul telefono»: org.json è quella di Android;
#       · «come in Android Studio»: org.json è la libreria di riferimento
#         (la stessa che usa ./gradlew test).
#
# Gli stessi test girano anche in Android Studio: tasto destro sulla cartella
# app/src/test → Run 'Tests in app', oppure ./gradlew testDebugUnitTest.
#
# Uso: Kalend/tools/native-test.sh            (esce con 0 se tutto passa)
# ══════════════════════════════════════════════════════════════════
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/android-src/app"
CACHE="${KALEND_SDK_CACHE:-/tmp/kalend-sdk-cache}"
JAR="$CACHE/android-all-16.jar"
LIBS="$CACHE/test-libs"
MAVEN="https://repo1.maven.org/maven2"

# ── 1. codice dell'app ──
bash "$ROOT/tools/native-check.sh" | tail -1
MAIN_OUT="$CACHE/out"

# ── 2. librerie dei test, con impronta verificata ──
mkdir -p "$LIBS"
fetch() {   # fetch <percorso Maven> <sha256 atteso>
  local path="$1" sum="$2" f="$LIBS/$(basename "$1")"
  if [ ! -s "$f" ] || ! echo "$sum  $f" | sha256sum -c - >/dev/null 2>&1; then
    local ok=0
    for wait in 2 4 8 16; do
      if curl -sSf -o "$f" "$MAVEN/$path"; then ok=1; break; fi
      sleep "$wait"
    done
    [ "$ok" = 1 ] || { echo "download non riuscito: $path"; exit 1; }
  fi
  echo "$sum  $f" | sha256sum -c - >/dev/null 2>&1 || { echo "IMPRONTA SBAGLIATA: $f (file rimosso)"; rm -f "$f"; exit 1; }
  echo "$f"
}
JUNIT=$(fetch junit/junit/4.13.2/junit-4.13.2.jar 8e495b634469d64fb8acfa3495a065cbacc8a0fff55ce1e31007be4c16dc57d3)
HAMCREST=$(fetch org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar 66fdef91e9739348df7a096aa384a5685f4e875584cce89386a7a47251c4d8e9)
ORGJSON=$(fetch org/json/json/20250517/json-20250517.jar 3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796)

# ── 3. compilazione dei test ──
TEST_OUT="$CACHE/test-out"; rm -rf "$TEST_OUT"; mkdir -p "$TEST_OUT"
TEST_FILES=$(find "$APP/src/test/java" -name '*.java')
javac -nowarn -encoding UTF-8 --release 17 -cp "$MAIN_OUT:$JUNIT:$HAMCREST:$JAR" -d "$TEST_OUT" $TEST_FILES 2>&1 | grep -v "JAVA_TOOL_OPTIONS" || true
CLASSES=$(cd "$TEST_OUT" && find . -name '*Test.class' | sed 's|^\./||; s|\.class$||; s|/|.|g' | sort)
[ -n "$CLASSES" ] || { echo "ERRORI DI COMPILAZIONE DEI TEST"; exit 1; }
echo "test compilati: $(echo $CLASSES | wc -w) classi"

# ── 4. esecuzione, due giri ──
run() {   # run <titolo> <classpath>: mostra il riepilogo e, se qualcosa fallisce, il perché
  echo "── $1"
  local log="$CACHE/test-run.log" rc=0
  java -Dkalend.appDir="$APP" -cp "$2" org.junit.runner.JUnitCore $CLASSES >"$log" 2>&1 || rc=$?
  grep -v "JAVA_TOOL_OPTIONS" "$log" \
    | grep -E "^(OK|Tests run|FAILURES|[0-9]+\) |java.lang.AssertionError|	at app\.kalend|Caused by|.*Exception)" | head -60 || true
  return "$rc"
}
STATUS=0
run "giro 1: come sul telefono (org.json di Android)" "$TEST_OUT:$MAIN_OUT:$JUNIT:$HAMCREST:$JAR" || STATUS=1
run "giro 2: come in Android Studio (org.json di riferimento)" "$TEST_OUT:$MAIN_OUT:$JUNIT:$HAMCREST:$ORGJSON:$JAR" || STATUS=1
if [ "$STATUS" = 0 ]; then echo "TUTTI I TEST NATIVI SUPERATI"; else echo "CI SONO TEST FALLITI"; fi
exit "$STATUS"
