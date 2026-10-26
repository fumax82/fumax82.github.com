// Compilazione del modulo "app": versione Android, firma dell'APK e librerie usate.

import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "it.formazione.videotutorial"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.formazione.videotutorial"
        minSdk = 26
        targetSdk = 35
        // Aumentare versionCode a ogni nuova versione da installare sopra la precedente.
        versionCode = 6
        versionName = "2.0-fase2"
    }

    // Firma dell'APK.
    // Se sono presenti le variabili FIRMA_FILE, FIRMA_PASSWORD e FIRMA_ALIAS
    // (su GitHub arrivano dai "Secrets" del repository) si usa quella chiave:
    // così ogni nuova versione si installa sopra la precedente.
    // Altrimenti si usa la chiave di debug standard, che va bene per le prove.
    val fileFirma = System.getenv("FIRMA_FILE")?.let { file(it) }?.takeIf { it.exists() }
    signingConfigs {
        if (fileFirma != null) {
            create("firmaApp") {
                storeFile = fileFirma
                storePassword = System.getenv("FIRMA_PASSWORD")
                keyAlias = System.getenv("FIRMA_ALIAS")
                keyPassword = System.getenv("FIRMA_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (fileFirma != null) {
                signingConfigs.getByName("firmaApp")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    // I controlli automatici di stile non bloccano la creazione dell'APK
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // Base Android e ciclo di vita
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Interfaccia grafica (Jetpack Compose, Material 3)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.material3)

    // Lettore video
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.ui)

    // Lavori in sottofondo (estrazione audio)
    implementation(libs.androidx.work.runtime.ktx)

    // Accesso alla cartella condivisa scelta dall'utente
    implementation(libs.androidx.documentfile)

    // Lettura e scrittura di indice.json
    implementation(libs.kotlinx.serialization.json)
}
