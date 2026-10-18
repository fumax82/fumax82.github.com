// =====================================================================
// nucleo/build.gradle.kts
// Libreria Kotlin "pura" (senza Android) con i test automatici.
// =====================================================================
plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
}

group = "com.ric.navigatore"
version = "1.0"

// Bytecode per Java 17: la stessa versione usata dall'app Android
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}
kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    // Lettura/scrittura JSON (licenza Apache 2.0)
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    // JTS: geometria seria (buffer attorno alle strade, unione di aree,
    // intersezioni). Licenza EPL 2.0 / EDL 1.0
    api("org.locationtech.jts:jts-core:1.20.0")

    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
    // mostra in console l'esito di ogni prova
    testLogging { events("passed", "failed", "skipped"); showStandardStreams = true }
}
