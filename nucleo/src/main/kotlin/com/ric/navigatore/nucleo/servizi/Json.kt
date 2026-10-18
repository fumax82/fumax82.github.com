package com.ric.navigatore.nucleo.servizi

import com.ric.navigatore.nucleo.geo.Punto
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Piccoli aiuti per leggere il JSON dei servizi senza errori
 * quando un campo manca (i servizi omettono spesso i campi a zero).
 */
internal object J {
    val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun leggi(testo: String): JsonElement? = runCatching { json.parseToJsonElement(testo) }.getOrNull()

    fun JsonElement?.ogg(nome: String): JsonObject? = (this as? JsonObject)?.get(nome) as? JsonObject
    fun JsonElement?.lista(nome: String): JsonArray? = (this as? JsonObject)?.get(nome) as? JsonArray
    fun JsonElement?.testo(nome: String): String? =
        ((this as? JsonObject)?.get(nome) as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
    fun JsonElement?.numero(nome: String): Double? =
        ((this as? JsonObject)?.get(nome) as? JsonPrimitive)?.doubleOrNull
    fun JsonElement?.intero(nome: String): Int? =
        ((this as? JsonObject)?.get(nome) as? JsonPrimitive)?.intOrNull

    /** [lon, lat] -> Punto */
    fun JsonElement.comePunto(): Punto {
        val a = jsonArray
        return Punto(a[1].jsonPrimitive.content.toDouble(), a[0].jsonPrimitive.content.toDouble())
    }

    /** Punto -> [lon, lat] (ordine GeoJSON!) */
    fun Punto.comeJson(): JsonArray = buildJsonArray {
        add(JsonPrimitive(arrotonda(lon)))
        add(JsonPrimitive(arrotonda(lat)))
    }

    /** 6 decimali = circa 10 cm: basta e riduce la dimensione delle richieste. */
    private fun arrotonda(g: Double) = Math.round(g * 1_000_000) / 1_000_000.0

    fun JsonElement.oggetto(): JsonObject? = this as? JsonObject
    fun JsonElement.campo(nome: String): JsonElement? = jsonObject[nome]
}
