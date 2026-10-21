package com.thomcall.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OverlayService extends Service {
    public static final String ACTION_SHOW = "com.thomcall.app.action.SHOW";
    private static final String CHANNEL_ID = "thom_call_overlay";
    private static final int NOTIFICATION_ID = 71;
    private static final int BUBBLE_DP = 64;

    private static OverlayService instance;

    private WindowManager windowManager;
    private FrameLayout overlayRoot;
    private LinearLayout panel;
    private FrameLayout bubble;
    private WebView webView;
    private WindowManager.LayoutParams params;
    private int panelWidth;
    private int panelHeight;
    private int bubbleX;
    private int bubbleY;
    private boolean expanded;
    private boolean showing;

    public static boolean isActive() {
        return instance != null && instance.showing;
    }

    public static void restoreTo(MainActivity activity) {
        if (instance != null) instance.restore(activity);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_SHOW.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (showing) return START_NOT_STICKY;
        startForegroundNow();
        if (!Settings.canDrawOverlays(this) || !showOverlay()) stopSelf();
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (showing) {
            MainActivity activity = MainActivity.instance;
            if (activity != null) restore(activity);
            else removeOverlay();
        }
        instance = null;
        super.onDestroy();
    }

    private void startForegroundNow() {
        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = builder
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentTitle("Thom Call")
                .setContentText("Chamada em bolha")
                .setContentIntent(pending)
                .setOngoing(true)
                .setShowWhen(false)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
            if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            }
            try {
                startForeground(NOTIFICATION_ID, notification, type);
                return;
            } catch (Exception ignored) {
            }
        }
        startForeground(NOTIFICATION_ID, notification);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Bolha da chamada",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém a chamada do Thom Call em uma bolha flutuante.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private boolean showOverlay() {
        MainActivity activity = MainActivity.instance;
        if (activity == null) return false;
        WebView view = activity.detachWebView();
        if (view == null) return false;
        webView = view;
        view.evaluateJavascript("if(typeof toggleMiniCall==='function')toggleMiniCall(false);", null);
        setupKeyboard(view);

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        panelWidth = Math.min(dp(360), screenWidth - dp(24));
        panelHeight = Math.min(dp(560), screenHeight - dp(120));

        panel = buildPanel(view);
        bubble = buildBubble();
        overlayRoot = new FrameLayout(this);
        overlayRoot.setClipChildren(true);
        overlayRoot.addView(panel, new FrameLayout.LayoutParams(panelWidth, panelHeight));
        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(
                dp(BUBBLE_DP - 8), dp(BUBBLE_DP - 8), Gravity.CENTER);
        overlayRoot.addView(bubble, bubbleParams);
        panel.setAlpha(0f);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        int flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
        params = new WindowManager.LayoutParams(dp(BUBBLE_DP), dp(BUBBLE_DP), type, flags,
                PixelFormat.TRANSLUCENT);
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                | WindowManager.LayoutParams.SOFT_INPUT_STATE_UNCHANGED;
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(dp(8), screenWidth - dp(BUBBLE_DP) - dp(12));
        params.y = Math.max(dp(72), (screenHeight - dp(BUBBLE_DP)) / 2);
        bubbleX = params.x;
        bubbleY = params.y;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        try {
            windowManager.addView(overlayRoot, params);
        } catch (Exception error) {
            overlayRoot = null;
            panel = null;
            bubble = null;
            webView = null;
            activity.attachWebView(view);
            return false;
        }
        showing = true;
        expanded = false;
        activity.moveTaskToBack(true);
        return true;
    }

    private LinearLayout buildPanel(WebView view) {
        GradientDrawable background = new GradientDrawable();
        background.setColor(0xFF0B0E15);
        background.setCornerRadius(dp(16));
        background.setStroke(dp(1), 0x33FFFFFF);

        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackground(background);
        shell.setClipToOutline(true);
        shell.setElevation(dp(14));
        shell.addView(buildHeader(), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        shell.addView(view, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        return shell;
    }

    private FrameLayout buildBubble() {
        FrameLayout circle = new FrameLayout(this);
        GradientDrawable background = new GradientDrawable();
        background.setShape(GradientDrawable.OVAL);
        background.setColor(0xFF5B5BF6);
        background.setStroke(dp(2), 0x66FFFFFF);
        circle.setBackground(background);
        circle.setElevation(dp(12));
        circle.setContentDescription("Abrir chamada em bolha");

        TextView mark = new TextView(this);
        mark.setText("T");
        mark.setTextColor(0xFFFFFFFF);
        mark.setTextSize(24);
        mark.setGravity(Gravity.CENTER);
        mark.setTypeface(null, Typeface.BOLD);
        circle.addView(mark, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        View dot = new View(this);
        GradientDrawable dotBackground = new GradientDrawable();
        dotBackground.setShape(GradientDrawable.OVAL);
        dotBackground.setColor(0xFF2BD98B);
        dot.setBackground(dotBackground);
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(dp(12), dp(12),
                Gravity.BOTTOM | Gravity.END);
        dotParams.setMargins(0, 0, dp(6), dp(6));
        circle.addView(dot, dotParams);

        circle.setOnTouchListener(new BubbleTouchListener());
        return circle;
    }

    private LinearLayout buildHeader() {
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), 0, dp(6), 0);
        header.setBackgroundColor(0xFF121622);

        LinearLayout labels = new LinearLayout(this);
        labels.setOrientation(LinearLayout.VERTICAL);
        labels.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText("Thom Call");
        title.setTextColor(0xFFE9EDF7);
        title.setTextSize(14);
        title.setTypeface(null, Typeface.BOLD);
        TextView hint = new TextView(this);
        hint.setText("sobreposição");
        hint.setTextColor(0xFF8E97AD);
        hint.setTextSize(10);
        labels.addView(title);
        labels.addView(hint);

        View spacer = new View(this);
        Button collapse = new Button(this);
        collapse.setText("Bolha");
        collapse.setAllCaps(false);
        collapse.setTextColor(0xFFB9B0FF);
        collapse.setTextSize(13);
        collapse.setBackgroundColor(Color.TRANSPARENT);
        collapse.setMinWidth(0);
        collapse.setMinimumWidth(0);
        collapse.setPadding(dp(8), 0, dp(8), 0);
        collapse.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                collapseToBubble();
            }
        });

        Button open = new Button(this);
        open.setText("Abrir");
        open.setAllCaps(false);
        open.setTextColor(0xFFB9B0FF);
        open.setTextSize(13);
        open.setBackgroundColor(Color.TRANSPARENT);
        open.setMinWidth(0);
        open.setMinimumWidth(0);
        open.setPadding(dp(8), 0, dp(8), 0);
        open.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openApp();
            }
        });

        header.addView(labels, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        header.addView(collapse, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        header.addView(open, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));

        DragListener drag = new DragListener();
        header.setOnTouchListener(drag);
        labels.setOnTouchListener(drag);
        title.setOnTouchListener(drag);
        hint.setOnTouchListener(drag);
        return header;
    }

    private void expandPanel() {
        if (expanded || panel == null || bubble == null) return;
        expanded = true;
        bubble.setVisibility(View.GONE);
        panel.setAlpha(1f);
        params.width = panelWidth;
        params.height = panelHeight;
        params.x = clamp(params.x, dp(8), getResources().getDisplayMetrics().widthPixels - panelWidth - dp(8));
        params.y = clamp(params.y, dp(8), getResources().getDisplayMetrics().heightPixels - panelHeight - dp(16));
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                | WindowManager.LayoutParams.SOFT_INPUT_STATE_UNCHANGED;
        windowManager.updateViewLayout(overlayRoot, params);
        webView.requestFocus(View.FOCUS_DOWN);
    }

    private void collapseToBubble() {
        if (!expanded || panel == null || bubble == null) return;
        hideKeyboard();
        expanded = false;
        panel.setAlpha(0f);
        bubble.setVisibility(View.VISIBLE);
        params.width = dp(BUBBLE_DP);
        params.height = dp(BUBBLE_DP);
        params.x = clamp(bubbleX, 0, getResources().getDisplayMetrics().widthPixels - dp(BUBBLE_DP));
        params.y = clamp(bubbleY, 0, getResources().getDisplayMetrics().heightPixels - dp(BUBBLE_DP));
        windowManager.updateViewLayout(overlayRoot, params);
    }

    private void openApp() {
        MainActivity activity = MainActivity.instance;
        if (activity != null) restore(activity);
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
    }

    private void restore(MainActivity activity) {
        WebView view = webView;
        if (activity != null) activity.showRestoreLoading();
        if (view != null) {
            if (view.getParent() instanceof ViewGroup) {
                ((ViewGroup) view.getParent()).removeView(view);
            }
            if (activity != null) activity.attachWebView(view);
        }
        removeOverlay();
        webView = null;
        stopForeground(true);
        stopSelf();
    }

    private void removeOverlay() {
        hideKeyboard();
        if (overlayRoot != null) {
            try {
                windowManager.removeView(overlayRoot);
            } catch (Exception ignored) {
            }
            overlayRoot = null;
        }
        panel = null;
        bubble = null;
        showing = false;
    }

    private void setupKeyboard(final WebView view) {
        view.setFocusable(true);
        view.setFocusableInTouchMode(true);
        view.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View target, MotionEvent event) {
                if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                    view.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            showKeyboardForEditor(view);
                        }
                    }, 80);
                }
                return false;
            }
        });
    }

    private void showKeyboardForEditor(final WebView view) {
        if (!expanded || view != webView) return;
        view.evaluateJavascript(
                "(function(){var e=document.activeElement;if(!e)return false;"
                        + "var t=(e.tagName||'').toLowerCase();"
                        + "if(t==='textarea')return true;"
                        + "if(t==='input'){var ty=(e.type||'text').toLowerCase();"
                        + "return !/^(button|checkbox|color|file|hidden|image|radio|range|reset|submit)$/.test(ty);}"
                        + "return !!e.isContentEditable;})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) showKeyboard(view, 0);
                    }
                });
    }

    private void showKeyboard(final WebView view, final int attempt) {
        if (!expanded || view == null || view != webView) return;
        if (!view.hasWindowFocus() && attempt < 6) {
            view.postDelayed(new Runnable() {
                @Override
                public void run() {
                    showKeyboard(view, attempt + 1);
                }
            }, 100);
            return;
        }
        view.requestFocus(View.FOCUS_DOWN);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = view.getWindowInsetsController();
            if (controller != null) controller.show(WindowInsets.Type.ime());
        }
        InputMethodManager input = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (input != null) input.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT);
        view.postDelayed(new Runnable() {
            @Override
            public void run() {
                view.evaluateJavascript(
                        "(function(){var e=document.activeElement;if(!e)return;"
                                + "function s(){try{e.scrollIntoView({block:'start'});}catch(_){e.scrollIntoView();}}"
                                + "s();[80,260,600,1000,1500].forEach(function(d){setTimeout(s,d);});})()",
                        null);
            }
        }, 300);
    }

    private void hideKeyboard() {
        if (webView == null) return;
        InputMethodManager input = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (input != null) input.hideSoftInputFromWindow(webView.getWindowToken(), 0);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(Math.max(min, max), value));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class BubbleTouchListener implements View.OnTouchListener {
        private float downX;
        private float downY;
        private int startX;
        private int startY;
        private long downAt;
        private boolean moved;

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            if (params == null || overlayRoot == null) return false;
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                downX = event.getRawX();
                downY = event.getRawY();
                startX = params.x;
                startY = params.y;
                downAt = System.currentTimeMillis();
                moved = false;
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                int dx = Math.round(event.getRawX() - downX);
                int dy = Math.round(event.getRawY() - downY);
                int slop = ViewConfiguration.get(OverlayService.this).getScaledTouchSlop();
                if (Math.abs(dx) > slop || Math.abs(dy) > slop) moved = true;
                if (!moved) return true;
                params.x = clamp(startX + dx, 0,
                        getResources().getDisplayMetrics().widthPixels - params.width);
                params.y = clamp(startY + dy, 0,
                        getResources().getDisplayMetrics().heightPixels - params.height);
                bubbleX = params.x;
                bubbleY = params.y;
                windowManager.updateViewLayout(overlayRoot, params);
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_UP) {
                bubbleX = params.x;
                bubbleY = params.y;
                if (!moved && System.currentTimeMillis() - downAt < 400) expandPanel();
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_CANCEL) return true;
            return false;
        }
    }

    private final class DragListener implements View.OnTouchListener {
        private int startX;
        private int startY;
        private float touchX;
        private float touchY;

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            if (params == null || overlayRoot == null || !expanded) return false;
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                startX = params.x;
                startY = params.y;
                touchX = event.getRawX();
                touchY = event.getRawY();
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                params.x = clamp(startX + Math.round(event.getRawX() - touchX), 0,
                        getResources().getDisplayMetrics().widthPixels - params.width);
                params.y = clamp(startY + Math.round(event.getRawY() - touchY), 0,
                        getResources().getDisplayMetrics().heightPixels - params.height);
                windowManager.updateViewLayout(overlayRoot, params);
                return true;
            }
            return false;
        }
    }
}
