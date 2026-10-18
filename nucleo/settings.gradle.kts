// =====================================================================
// nucleo/settings.gradle.kts
// Il "nucleo" è la parte dell'app che NON dipende da Android:
// geometria, vincoli, richieste al motore di percorso, validazione e
// logica di navigazione. Si può compilare e provare su qualsiasi
// computer con:   cd nucleo  &&  gradle test
// L'app Android lo include automaticamente (vedi ../settings.gradle.kts).
// =====================================================================
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
        // copia alternativa dello stesso archivio (utile se il primo è sovraccarico)
        maven("https://repo1.maven.org/maven2")
    }
}

rootProject.name = "nucleo"
