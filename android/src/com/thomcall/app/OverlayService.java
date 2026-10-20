package com.thomcall.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OverlayService extends Service {
    public static final String ACTION_SHOW = "com.thomcall.app.action.SHOW";
    private static final String CHANNEL_ID = "thom_call_overlay";
    private static final int NOTIFICATION_ID = 71;

    private static OverlayService instance;

    private WindowManager windowManager;
    private LinearLayout shell;
    private WebView webView;
    private WindowManager.LayoutParams params;
    private int initialX;
    private int initialY;
    private float touchX;
    private float touchY;
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
                .setContentText("Chamada em sobreposição")
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
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Sobreposição da chamada",
                NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantém a chamada do Thom Call flutuando sobre outros apps.");
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

        GradientDrawable background = new GradientDrawable();
        background.setColor(0xFF0B0E15);
        background.setCornerRadius(dp(16));
        background.setStroke(dp(1), 0x33FFFFFF);

        shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackground(background);
        shell.setClipToOutline(true);
        shell.setElevation(dp(14));
        shell.addView(buildHeader(), new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        shell.addView(view, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        int width = Math.min(dp(360), getResources().getDisplayMetrics().widthPixels - dp(20));
        int height = Math.min(dp(560), getResources().getDisplayMetrics().heightPixels - dp(96));
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        int flags = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
        params = new WindowManager.LayoutParams(width, height, type, flags, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Math.max(dp(8), getResources().getDisplayMetrics().widthPixels - width - dp(12));
        params.y = dp(72);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        try {
            windowManager.addView(shell, params);
        } catch (Exception error) {
            shell = null;
            webView = null;
            activity.attachWebView(view);
            return false;
        }
        showing = true;
        return true;
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
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        TextView hint = new TextView(this);
        hint.setText("sobreposição");
        hint.setTextColor(0xFF8E97AD);
        hint.setTextSize(10);
        labels.addView(title);
        labels.addView(hint);

        View spacer = new View(this);
        Button open = new Button(this);
        open.setText("Abrir");
        open.setAllCaps(false);
        open.setTextColor(0xFFB9B0FF);
        open.setTextSize(13);
        open.setBackgroundColor(Color.TRANSPARENT);
        open.setMinWidth(0);
        open.setMinimumWidth(0);
        open.setPadding(dp(12), 0, dp(12), 0);
        open.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openApp();
            }
        });

        header.addView(labels, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1));
        header.addView(open, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));

        DragListener drag = new DragListener();
        header.setOnTouchListener(drag);
        labels.setOnTouchListener(drag);
        title.setOnTouchListener(drag);
        hint.setOnTouchListener(drag);
        return header;
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
        if (shell != null) {
            try {
                windowManager.removeView(shell);
            } catch (Exception ignored) {
            }
            shell = null;
        }
        showing = false;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class DragListener implements View.OnTouchListener {
        @Override
        public boolean onTouch(View view, MotionEvent event) {
            if (params == null || shell == null) return false;
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                initialX = params.x;
                initialY = params.y;
                touchX = event.getRawX();
                touchY = event.getRawY();
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                int maxX = Math.max(0, getResources().getDisplayMetrics().widthPixels - params.width);
                int maxY = Math.max(0, getResources().getDisplayMetrics().heightPixels - params.height);
                params.x = Math.max(0, Math.min(maxX, initialX + Math.round(event.getRawX() - touchX)));
                params.y = Math.max(0, Math.min(maxY, initialY + Math.round(event.getRawY() - touchY)));
                windowManager.updateViewLayout(shell, params);
                return true;
            }
            return false;
        }
    }
}
