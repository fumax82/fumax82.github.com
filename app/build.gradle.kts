// =====================================================================
// app/build.gradle.kts
// Impostazioni dell'app: nome del pacchetto, versioni di Android
// supportate e librerie usate (tutte gratuite e open source).
// =====================================================================
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    // Nome "tecnico" dell'app (deve essere unico sul telefono)
    namespace = "com.ric.navigatore"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.ric.navigatore"
        minSdk = 26          // Android 8.0 o successivo
        targetSdk = 36
        versionCode = 2      // aumentalo ad ogni nuova versione
        versionName = "1.1"
        // Telefoni a 64 e 32 bit + emulatore (x86_64)
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            // niente offuscamento: il codice resta leggibile anche nell'APK
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += listOf("META-INF/AL2.0", "META-INF/LGPL2.1", "META-INF/versions/9/module-info.class")
        }
    }
}

dependencies {
    // La logica dell'app (vedi la cartella nucleo/)
    implementation("com.ric.navigatore:nucleo:1.0")

    // Jetpack Compose: l'interfaccia grafica (Google, Apache 2.0)
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core:1.7.8")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("androidx.core:core-ktx:1.19.1")

    // MapLibre Native: disegna la mappa (BSD 2-Clause)
    implementation("org.maplibre.gl:android-sdk:13.7.1")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")

    // Prove sull'emulatore
    androidTestImplementation(platform("androidx.compose:compose-bom:2026.09.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:rules:1.7.0")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
