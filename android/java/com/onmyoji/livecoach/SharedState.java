package com.onmyoji.livecoach;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Two independent snapshots avoid a race where the full app and the floating
 * panel overwrite each other while both are ticking.
 */
public final class SharedState {

    private static final String PREFS = "coach_shared";
    private static final String KEY_MAIN = "snapshot_main";
    private static final String KEY_OVERLAY = "snapshot_overlay";
    private static final int MAX_LENGTH = 24_000;

    private SharedState() {}

    public static String readMain(Context context) {
        return prefs(context).getString(KEY_MAIN, null);
    }

    public static String readOverlay(Context context) {
        return prefs(context).getString(KEY_OVERLAY, null);
    }

    public static void writeMain(Context context, String json) {
        write(context, KEY_MAIN, json);
    }

    public static void writeOverlay(Context context, String json) {
        write(context, KEY_OVERLAY, json);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void write(Context context, String key, String json) {
        if (json == null || json.isEmpty() || json.length() > MAX_LENGTH) return;
        prefs(context).edit().putString(key, json).apply();
    }
}
