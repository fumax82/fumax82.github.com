package app.kalend;

import android.content.SharedPreferences;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * SharedPreferences finte, tutte in memoria: bastano per provare le funzioni che leggono e
 * scrivono le preferenze (es. WidgetLists.overlay / take) senza un telefono.
 * Le modifiche dell'editor vengono applicate subito da apply() e commit().
 */
final class FakePrefs implements SharedPreferences {
    final Map<String, Object> map = new HashMap<>();

    @Override public Map<String, ?> getAll() { return new HashMap<>(map); }
    @Override public String getString(String k, String def) { Object v = map.get(k); return v instanceof String ? (String) v : def; }
    @SuppressWarnings("unchecked")
    @Override public Set<String> getStringSet(String k, Set<String> def) { Object v = map.get(k); return v instanceof Set ? (Set<String>) v : def; }
    @Override public int getInt(String k, int def) { Object v = map.get(k); return v instanceof Integer ? (Integer) v : def; }
    @Override public long getLong(String k, long def) { Object v = map.get(k); return v instanceof Long ? (Long) v : def; }
    @Override public float getFloat(String k, float def) { Object v = map.get(k); return v instanceof Float ? (Float) v : def; }
    @Override public boolean getBoolean(String k, boolean def) { Object v = map.get(k); return v instanceof Boolean ? (Boolean) v : def; }
    @Override public boolean contains(String k) { return map.containsKey(k); }
    @Override public void registerOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) {}
    @Override public void unregisterOnSharedPreferenceChangeListener(OnSharedPreferenceChangeListener l) {}

    @Override public Editor edit() {
        return new Editor() {
            private final Map<String, Object> put = new HashMap<>();
            private final java.util.List<String> del = new java.util.ArrayList<>();
            private boolean clear;
            @Override public Editor putString(String k, String v) { put.put(k, v); return this; }
            @Override public Editor putStringSet(String k, Set<String> v) { put.put(k, v); return this; }
            @Override public Editor putInt(String k, int v) { put.put(k, v); return this; }
            @Override public Editor putLong(String k, long v) { put.put(k, v); return this; }
            @Override public Editor putFloat(String k, float v) { put.put(k, v); return this; }
            @Override public Editor putBoolean(String k, boolean v) { put.put(k, v); return this; }
            @Override public Editor remove(String k) { del.add(k); return this; }
            @Override public Editor clear() { clear = true; return this; }
            @Override public boolean commit() { apply(); return true; }
            @Override public void apply() {
                if (clear) map.clear();
                for (String k : del) map.remove(k);
                map.putAll(put);
            }
        };
    }
}
