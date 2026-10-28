#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# VERIFICA DI COMPILAZIONE della parte nativa SENZA l'SDK Android.
# Compila i sorgenti Java di android-src/ con javac contro il jar
# "android-all" di Robolectric (le classi vere del framework, API 36)
# scaricato da Maven Central, generando una R.java provvisoria dalle
# risorse. Serve a trovare errori di sintassi e di API prima di aprire
# il progetto in Android Studio: NON produce un APK (per quello serve
# l'SDK: ./gradlew assembleDebug).
# Uso: Kalend/tools/native-check.sh
# ══════════════════════════════════════════════════════════════════
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/android-src/app/src/main"
CACHE="${KALEND_SDK_CACHE:-/tmp/kalend-sdk-cache}"
JAR="$CACHE/android-all-16.jar"
VER="16-robolectric-13921718"
mkdir -p "$CACHE"
if [ ! -s "$JAR" ]; then
  echo "scarico android-all ($VER) da Maven Central…"
  curl -sSL -o "$JAR" "https://repo1.maven.org/maven2/org/robolectric/android-all/$VER/android-all-$VER.jar"
fi
OUT="$CACHE/out"; GEN="$CACHE/gen/app/kalend"; rm -rf "$OUT" "$GEN"; mkdir -p "$OUT" "$GEN"

# R.java provvisoria: un id per ogni risorsa trovata in res/
python3 - "$SRC/res" "$GEN/R.java" <<'PY'
import os,re,sys
res,out=sys.argv[1],sys.argv[2]
types={}
for d in sorted(os.listdir(res)):
    t=d.split('-')[0]
    for f in sorted(os.listdir(os.path.join(res,d))):
        name=os.path.splitext(f)[0]
        if t=='values':
            txt=open(os.path.join(res,d,f),encoding='utf-8').read()
            for m in re.finditer(r'<(string|plurals|style|color|dimen|bool|integer|string-array|array)\s+name="([^"]+)"',txt):
                types.setdefault(m.group(1).replace('string-array','array'),set()).add(m.group(2))
        else:
            types.setdefault(t,set()).add(name)
        if t=='layout':
            txt=open(os.path.join(res,d,f),encoding='utf-8').read()
            for m in re.finditer(r'@\+id/(\w+)',txt): types.setdefault('id',set()).add(m.group(1))
lines=['package app.kalend;','public final class R {']
base=0x7f010000
for i,(t,names) in enumerate(sorted(types.items())):
    lines.append('  public static final class %s {'%t)
    for j,n in enumerate(sorted(names)): lines.append('    public static final int %s=0x%08x;'%(n,base+i*0x10000+j))
    lines.append('  }')
lines.append('}')
open(out,'w').write('\n'.join(lines)+'\n')
print('R.java:',', '.join('%s=%d'%(t,len(n)) for t,n in sorted(types.items())))
PY
# BuildConfig provvisoria (Gradle la genera da sé)
cat > "$GEN/BuildConfig.java" <<JAVA
package app.kalend;
public final class BuildConfig { public static final boolean DEBUG=false; public static final String VERSION_NAME="55.0"; public static final int VERSION_CODE=55; public static final String CONTACT="https://github.com/fumax82/fumax82.github.com"; }
JAVA
FILES=$(find "$SRC/java" "$CACHE/gen" -name '*.java')
javac -nowarn -Xlint:none -encoding UTF-8 --release 17 -cp "$JAR" -d "$OUT" $FILES 2>&1 | grep -v "JAVA_TOOL_OPTIONS" || true
N=$(find "$OUT" -name '*.class' | wc -l)
if [ "$N" -gt 0 ] && ! javac -nowarn -encoding UTF-8 --release 17 -cp "$JAR" -d "$OUT" $FILES >/dev/null 2>&1; then echo "ERRORI DI COMPILAZIONE"; exit 1; fi
echo "compilazione OK: $N classi"
