package com.onmyoji.livecoach;

import android.content.Context;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;

/** Short native tones that work even before the WebView receives a user gesture. */
public final class NativeAlert {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private NativeAlert() {}

    public static void beep(Context context, String kind) {
        int tone;
        if ("live".equals(kind)) {
            tone = ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD;
        } else if ("phase".equals(kind)) {
            tone = ToneGenerator.TONE_PROP_ACK;
        } else if ("success".equals(kind)) {
            tone = ToneGenerator.TONE_PROP_ACK;
        } else {
            tone = ToneGenerator.TONE_PROP_BEEP2;
        }

        MAIN.post(() -> {
            try {
                ToneGenerator generator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 72);
                generator.startTone(tone, 240);
                MAIN.postDelayed(generator::release, 900);
            } catch (RuntimeException ignored) {
                // Audio may be unavailable while another app owns the stream.
            }
        });
    }
}
