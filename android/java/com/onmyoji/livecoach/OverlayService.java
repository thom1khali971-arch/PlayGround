package com.onmyoji.livecoach;

import android.animation.ValueAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.util.Locale;

public final class OverlayService extends Service {

    private static final String CHANNEL_ID = "coach_overlay";
    private static final int NOTIFICATION_ID = 7301;
    private static final String ACTION_TOGGLE = "com.onmyoji.livecoach.TOGGLE";
    public static final String ACTION_COLLAPSE = "com.onmyoji.livecoach.COLLAPSE";
    private static final String ACTION_STOP = "com.onmyoji.livecoach.STOP";
    private static final String UI_PREFS = "coach_overlay_ui";
    private static volatile boolean running;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private SharedPreferences uiPrefs;

    private View bubbleView;
    private TextView bubbleClock;
    private WindowManager.LayoutParams bubbleParams;
    private WebView panelView;
    private WindowManager.LayoutParams panelParams;
    private View alertView;
    private WindowManager.LayoutParams alertParams;
    private TextView alertKicker;
    private TextView alertTitle;
    private TextView alertDetail;
    private ValueAnimator snapAnimator;

    private int bubbleSize;
    private int panelWidth;
    private int panelHeight;
    private int screenWidth;
    private int screenHeight;
    private int statusBarHeight;
    private int navBarHeight;
    private boolean panelOpen;

    private final Runnable hideAlert = () -> {
        if (alertView != null) {
            alertView.animate()
                    .alpha(0f)
                    .translationY(-dp(8))
                    .setDuration(220)
                    .start();
        }
    };

    public static boolean isRunning() {
        return running;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        uiPrefs = getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE);
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
        startForegroundCompat();

        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return;
        }

        refreshMetrics();
        try {
            createBubble();
            createPanel();
        } catch (RuntimeException error) {
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_TOGGLE.equals(action)) {
                if (panelOpen) collapsePanel();
                else expandPanel();
            } else if (ACTION_COLLAPSE.equals(action)) {
                collapsePanel();
            } else if (ACTION_STOP.equals(action)) {
                stopSelf();
                return START_NOT_STICKY;
            }
        }
        return START_STICKY;
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        refreshMetrics();
        if (bubbleParams != null) {
            bubbleParams.width = bubbleSize;
            bubbleParams.height = bubbleSize;
            bubbleParams.x = clamp(bubbleParams.x, dp(8), screenWidth - bubbleSize - dp(8));
            bubbleParams.y = clamp(bubbleParams.y, minBubbleY(), maxBubbleY());
            safeUpdate(bubbleView, bubbleParams);
        }
        if (panelOpen) expandPanel();
        else hidePanelWindow();
        if (alertParams != null) {
            alertParams.width = Math.min(dp(380), screenWidth - dp(28));
            alertParams.y = statusBarHeight + dp(8);
            safeUpdate(alertView, alertParams);
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacksAndMessages(null);
        if (snapAnimator != null) snapAnimator.cancel();
        TtsEngine.stop();
        try {
            if (windowManager != null) {
                if (alertView != null) windowManager.removeViewImmediate(alertView);
                if (panelView != null) windowManager.removeViewImmediate(panelView);
                if (bubbleView != null) windowManager.removeViewImmediate(bubbleView);
            }
        } catch (RuntimeException ignored) {
            // View was already detached by the system.
        }
        if (panelView != null) {
            panelView.removeJavascriptInterface("AndroidCoach");
            panelView.loadUrl("about:blank");
            panelView.destroy();
            panelView = null;
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startForegroundCompat() {
        Intent openIntent = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent togglePending = PendingIntent.getService(
                this,
                1,
                new Intent(this, OverlayService.class).setAction(ACTION_TOGGLE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent stopPending = PendingIntent.getService(
                this,
                2,
                new Intent(this, OverlayService.class).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_coach)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(getString(R.string.notification_text))
                .setContentIntent(openPending)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setPriority(Notification.PRIORITY_LOW)
                .setVisibility(Notification.VISIBILITY_PUBLIC);

        builder.addAction(new Notification.Action.Builder(
                Icon.createWithResource(this, R.drawable.ic_stat_coach),
                getString(R.string.notification_panel),
                togglePending
        ).build());
        builder.addAction(new Notification.Action.Builder(
                Icon.createWithResource(this, R.drawable.ic_stat_coach),
                getString(R.string.notification_stop),
                stopPending
        ).build());

        Notification notification = builder.build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void createNotificationChannel() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel),
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.notification_channel_desc));
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    @SuppressWarnings("deprecation")
    private void refreshMetrics() {
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        screenWidth = metrics.widthPixels;
        screenHeight = metrics.heightPixels;
        bubbleSize = dp(76);
        panelWidth = Math.min(dp(360), screenWidth - dp(24));
        int statusId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        statusBarHeight = statusId > 0 ? getResources().getDimensionPixelSize(statusId) : dp(24);
        int navId = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        navBarHeight = navId > 0 ? getResources().getDimensionPixelSize(navId) : dp(48);
        int available = screenHeight - statusBarHeight - navBarHeight - dp(16);
        panelHeight = Math.min(dp(540), Math.max(dp(240), available));
    }

    private void createBubble() {
        FrameLayout bubble = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{0xFFF2764F, 0xFFC73528, 0xFF761717}
        );
        background.setShape(GradientDrawable.OVAL);
        background.setStroke(dp(2), 0xFFE9C77F);
        bubble.setBackground(background);
        bubble.setElevation(dp(12));
        bubble.setContentDescription(getString(R.string.bubble_description));

        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_bubble);
        icon.setColorFilter(0xFFFFF3D6);
        FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(
                dp(31), dp(31), Gravity.TOP | Gravity.CENTER_HORIZONTAL
        );
        iconParams.topMargin = dp(13);
        bubble.addView(icon, iconParams);

        TextView clock = new TextView(this);
        clock.setText("00:00");
        clock.setTextColor(0xFFE9C77F);
        clock.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9.5f);
        clock.setTypeface(Typeface.DEFAULT_BOLD);
        clock.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams clockParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        clockParams.bottomMargin = dp(8);
        bubble.addView(clock, clockParams);
        bubbleClock = clock;
        bubbleClock.setAlpha(0.6f);

        bubble.setOnTouchListener(new BubbleTouch());
        bubbleView = bubble;

        bubbleParams = new WindowManager.LayoutParams(
                bubbleSize,
                bubbleSize,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = clamp(
                uiPrefs.getInt("bubble_x", screenWidth - bubbleSize - dp(14)),
                dp(8),
                screenWidth - bubbleSize - dp(8)
        );
        bubbleParams.y = clamp(
                uiPrefs.getInt("bubble_y", (int) (screenHeight * 0.64f)),
                minBubbleY(),
                maxBubbleY()
        );
        if (Build.VERSION.SDK_INT >= 28) {
            bubbleParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        windowManager.addView(bubbleView, bubbleParams);
    }

    private void createPanel() {
        FrameLayout panel = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable();
        background.setColor(0xFF0F0D11);
        background.setCornerRadius(dp(20));
        background.setStroke(dp(1), 0x66E9C77F);
        panel.setBackground(background);
        panel.setClipToOutline(true);
        panel.setElevation(dp(18));

        WebView webView = new WebView(this);
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setContentDescription(getString(R.string.panel_description));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            settings.setAlgorithmicDarkeningAllowed(false);
        }
        webView.addJavascriptInterface(new OverlayBridge(), "AndroidCoach");
        webView.setWebViewClient(new LocalWebViewClient(this, false));
        webView.setWebChromeClient(new WebChromeClient());

        panel.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));
        panelView = webView;

        panelParams = new WindowManager.LayoutParams(
                panelWidth,
                panelHeight,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelParams.x = -panelWidth - dp(400);
        panelParams.y = dp(20);
        panelParams.alpha = 0.01f;
        if (Build.VERSION.SDK_INT >= 28) {
            panelParams.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        windowManager.addView(panelView, panelParams);
        panelView.onResume();
        panelView.resumeTimers();
        panelView.loadUrl(LocalWebViewClient.BASE_URL + "overlay.html");
    }

    private void expandPanel() {
        if (panelView == null || panelParams == null) return;
        panelOpen = true;
        if (alertView != null) hideAlert.run();
        bubbleView.setVisibility(View.GONE);
        panelParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        panelParams.alpha = 1f;
        panelParams.width = panelWidth;
        panelParams.height = panelHeight;
        panelParams.x = Math.max(0, (screenWidth - panelWidth) / 2);
        int centered = bubbleParams.y + bubbleSize / 2 - panelHeight / 2;
        int minPanelY = statusBarHeight + dp(8);
        panelParams.y = clamp(
                centered,
                minPanelY,
                Math.max(minPanelY, screenHeight - panelHeight - navBarHeight - dp(8))
        );
        safeUpdate(panelView, panelParams);
        panelView.onResume();
        panelView.resumeTimers();
        panelView.requestLayout();
        panelView.invalidate();
    }

    private void collapsePanel() {
        panelOpen = false;
        hidePanelWindow();
        if (bubbleView != null) bubbleView.setVisibility(View.VISIBLE);
    }

    private void hidePanelWindow() {
        if (panelView == null || panelParams == null) return;
        panelParams.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        panelParams.alpha = 0.01f;
        panelParams.x = -panelWidth - dp(400);
        panelParams.y = dp(20);
        safeUpdate(panelView, panelParams);
        // Keep the WebView resumed so the clock and objective alerts keep running.
        panelView.onResume();
        panelView.resumeTimers();
    }

    private void togglePanel() {
        if (panelOpen) collapsePanel();
        else expandPanel();
    }

    private void openApp() {
        collapsePanel();
        try {
            Intent intent = new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
        } catch (RuntimeException error) {
            Toast.makeText(this, R.string.notification_text, Toast.LENGTH_SHORT).show();
        }
    }

    private void showAlert(String title, String detail, String kind) {
        if (!Settings.canDrawOverlays(this) || panelOpen) return;
        ensureAlertView();
        if (alertView == null) return;

        boolean live = "live".equals(kind);
        GradientDrawable background = new GradientDrawable();
        background.setColor(0xF2140F12);
        background.setCornerRadius(dp(15));
        background.setStroke(dp(1), live ? 0xCCE3482D : 0x99E9C77F);
        alertView.setBackground(background);

        alertKicker.setText(live ? "OBJETIVO NO MAPA" : "PREPARE-SE");
        alertKicker.setTextColor(live ? 0xFFFF8B69 : 0xFFE9C77F);
        alertTitle.setText(title);
        alertDetail.setText(detail == null ? "" : detail);
        alertDetail.setVisibility(detail == null || detail.isEmpty() ? View.GONE : View.VISIBLE);

        alertView.animate().cancel();
        alertView.setTranslationY(-dp(10));
        alertView.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(190)
                .start();

        handler.removeCallbacks(hideAlert);
        handler.postDelayed(hideAlert, 5_000);
    }

    private void ensureAlertView() {
        if (alertView != null) return;
        try {
            LinearLayout box = new LinearLayout(this);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setPadding(dp(15), dp(11), dp(15), dp(12));
            box.setElevation(dp(16));

            TextView kicker = new TextView(this);
            kicker.setTextSize(TypedValue.COMPLEX_UNIT_SP, 8.5f);
            kicker.setTypeface(Typeface.DEFAULT_BOLD);
            kicker.setLetterSpacing(0.14f);
            box.addView(kicker);

            TextView title = new TextView(this);
            title.setTextColor(0xFFF5EFE4);
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f);
            title.setTypeface(Typeface.DEFAULT_BOLD);
            title.setMaxLines(2);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            titleParams.topMargin = dp(3);
            box.addView(title, titleParams);

            TextView detail = new TextView(this);
            detail.setTextColor(0xFFB9AC9F);
            detail.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f);
            detail.setMaxLines(2);
            LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
            );
            detailParams.topMargin = dp(2);
            box.addView(detail, detailParams);

            alertKicker = kicker;
            alertTitle = title;
            alertDetail = detail;
            alertView = box;

            alertParams = new WindowManager.LayoutParams(
                    Math.min(dp(380), screenWidth - dp(28)),
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                            | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                            | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT
            );
            alertParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            alertParams.y = statusBarHeight + dp(8);
            alertParams.alpha = 0f;
            if (Build.VERSION.SDK_INT >= 28) {
                alertParams.layoutInDisplayCutoutMode =
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            windowManager.addView(alertView, alertParams);
        } catch (RuntimeException error) {
            alertView = null;
        }
    }

    private void updateBubbleClock(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JSONObject object = new JSONObject(json);
            double seconds = object.optDouble("seconds", 0);
            boolean isRunning = object.optBoolean("running", false);
            if (Double.isNaN(seconds) || seconds < 0) seconds = 0;
            bubbleClock.setText(formatClock((int) seconds));
            bubbleClock.setAlpha(isRunning ? 1f : 0.58f);
        } catch (Exception ignored) {
            // Ignore malformed snapshots.
        }
    }

    private void snapBubble() {
        int target = bubbleParams.x + bubbleSize / 2 < screenWidth / 2
                ? dp(8)
                : screenWidth - bubbleSize - dp(8);
        if (snapAnimator != null) snapAnimator.cancel();
        snapAnimator = ValueAnimator.ofInt(bubbleParams.x, target);
        snapAnimator.setDuration(190);
        snapAnimator.addUpdateListener(animation -> {
            if (bubbleParams == null) return;
            bubbleParams.x = (int) animation.getAnimatedValue();
            safeUpdate(bubbleView, bubbleParams);
        });
        snapAnimator.start();
        uiPrefs.edit().putInt("bubble_x", target).putInt("bubble_y", bubbleParams.y).apply();
    }

    private void saveBubblePosition() {
        if (bubbleParams == null) return;
        uiPrefs.edit()
                .putInt("bubble_x", bubbleParams.x)
                .putInt("bubble_y", bubbleParams.y)
                .apply();
    }

    private void safeUpdate(View view, WindowManager.LayoutParams params) {
        if (view == null || params == null) return;
        try {
            windowManager.updateViewLayout(view, params);
        } catch (RuntimeException ignored) {
            // The view can disappear while an animation is running.
        }
    }

    private int minBubbleY() {
        return Math.max(dp(48), statusBarHeight + dp(8));
    }

    private int maxBubbleY() {
        return Math.max(minBubbleY(), screenHeight - bubbleSize - Math.max(dp(56), navBarHeight + dp(8)));
    }

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static String formatClock(int seconds) {
        int safe = Math.max(0, seconds);
        return String.format(Locale.US, "%02d:%02d", safe / 60, safe % 60);
    }

    private final class BubbleTouch implements View.OnTouchListener {
        private final int slop = ViewConfiguration.get(OverlayService.this).getScaledTouchSlop();
        private float downRawX;
        private float downRawY;
        private int startX;
        private int startY;
        private boolean dragging;

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    if (snapAnimator != null) snapAnimator.cancel();
                    downRawX = event.getRawX();
                    downRawY = event.getRawY();
                    startX = bubbleParams.x;
                    startY = bubbleParams.y;
                    dragging = false;
                    return true;

                case MotionEvent.ACTION_MOVE:
                    int dx = (int) (event.getRawX() - downRawX);
                    int dy = (int) (event.getRawY() - downRawY);
                    if (!dragging && Math.hypot(dx, dy) > slop) {
                        dragging = true;
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
                    }
                    if (dragging) {
                        bubbleParams.x = startX + dx;
                        bubbleParams.y = startY + dy;
                        safeUpdate(bubbleView, bubbleParams);
                    }
                    return true;

                case MotionEvent.ACTION_UP:
                    if (dragging) {
                        bubbleParams.x = clamp(bubbleParams.x, dp(8), screenWidth - bubbleSize - dp(8));
                        bubbleParams.y = clamp(bubbleParams.y, minBubbleY(), maxBubbleY());
                        saveBubblePosition();
                        snapBubble();
                    } else {
                        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                        togglePanel();
                    }
                    return true;

                case MotionEvent.ACTION_CANCEL:
                    if (dragging) {
                        saveBubblePosition();
                        snapBubble();
                    }
                    return true;

                default:
                    return false;
            }
        }
    }

    private final class OverlayBridge {

        @JavascriptInterface
        public String platform() {
            return "android-overlay";
        }

        @JavascriptInterface
        public String readMainState() {
            return SharedState.readMain(OverlayService.this);
        }

        @JavascriptInterface
        public String readOverlayState() {
            return SharedState.readOverlay(OverlayService.this);
        }

        @JavascriptInterface
        public void publishOverlayState(String json) {
            SharedState.writeOverlay(OverlayService.this, json);
            handler.post(() -> updateBubbleClock(json));
        }

        @JavascriptInterface
        public void syncClock(double seconds, boolean isRunning) {
            handler.post(() -> {
                if (bubbleClock == null) return;
                bubbleClock.setText(formatClock((int) Math.max(0, seconds)));
                bubbleClock.setAlpha(isRunning ? 1f : 0.58f);
            });
        }

        @JavascriptInterface
        public void collapsePanel() {
            handler.post(OverlayService.this::collapsePanel);
        }

        @JavascriptInterface
        public void togglePanel() {
            handler.post(OverlayService.this::togglePanel);
        }

        @JavascriptInterface
        public void openApp() {
            handler.post(OverlayService.this::openApp);
        }

        @JavascriptInterface
        public void notifyAlert(String title, String detail, String kind) {
            handler.post(() -> showAlert(title, detail, kind));
        }

        @JavascriptInterface
        public void speak(String text) {
            TtsEngine.speak(OverlayService.this, text);
        }

        @JavascriptInterface
        public void stopSpeaking() {
            TtsEngine.stop();
        }

        @JavascriptInterface
        public void beep(String kind) {
            NativeAlert.beep(OverlayService.this, kind);
        }
    }
}
