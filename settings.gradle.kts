// =====================================================================
// settings.gradle.kts
// Dice a Gradle (il programma che compila l'app) DOVE scaricare le
// librerie e QUALI parti fanno parte del progetto.
// =====================================================================
pluginManagement {
    repositories {
        google()            // librerie ufficiali Android (Compose, AndroidX)
        mavenCentral()      // librerie open source (MapLibre, JTS, Kotlin)
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Navigatore"

// Il "nucleo" (logica senza Android, con le sue prove) è un progetto a sé:
// lo includiamo così l'app lo usa direttamente dai sorgenti.
includeBuild("nucleo")

include(":app")
