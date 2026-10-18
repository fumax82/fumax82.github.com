// =====================================================================
// build.gradle.kts (radice del progetto)
// Qui si dichiarano solo le VERSIONI degli strumenti di compilazione.
// Le impostazioni vere dell'app sono in app/build.gradle.kts
// =====================================================================
plugins {
    // Android Gradle Plugin (Google)
    id("com.android.application") version "9.4.1" apply false
    // Compilatore Compose e serializzazione JSON (JetBrains)
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.4.21" apply false
}
