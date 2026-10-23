package com.onmyoji.livecoach;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

/** Native text-to-speech so Android WebView never silently loses voice alerts. */
public final class TtsEngine {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static TextToSpeech tts;
    private static boolean ready;
    private static String pending;

    private TtsEngine() {}

    public static void speak(Context context, String text) {
        if (text == null || text.trim().isEmpty()) return;
        Context app = context.getApplicationContext();
        MAIN.post(() -> {
            if (tts == null) {
                tts = new TextToSpeech(app, status -> {
                    if (status != TextToSpeech.SUCCESS) {
                        ready = false;
                        pending = null;
                        return;
                    }
                    ready = true;
                    Locale locale = Locale.forLanguageTag("pt-BR");
                    int result = tts.setLanguage(locale);
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                    }
                    tts.setSpeechRate(1.04f);
                    tts.setPitch(0.95f);
                    flushPending();
                });
            }
            if (ready) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "coach-alert");
            } else {
                pending = text;
            }
        });
    }

    private static void flushPending() {
        if (ready && pending != null) {
            tts.speak(pending, TextToSpeech.QUEUE_FLUSH, null, "coach-alert");
            pending = null;
        }
    }

    public static void stop() {
        MAIN.post(() -> {
            pending = null;
            if (tts != null) tts.stop();
        });
    }
}
