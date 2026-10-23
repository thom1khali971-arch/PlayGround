package com.onmyoji.livecoach;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

public final class MainActivity extends Activity {

    private static final int REQUEST_NOTIFICATIONS = 41;
    private static final String STATE_PENDING_BUBBLE = "pending_bubble";

    private WebView webView;
    private boolean pendingBubble;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) {
            pendingBubble = savedInstanceState.getBoolean(STATE_PENDING_BUBBLE, false);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF0B090C);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        configureWebView(webView);
        webView.addJavascriptInterface(new CoachBridge(), "AndroidCoach");
        webView.setWebViewClient(new LocalWebViewClient(this, true));
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
        webView.loadUrl(LocalWebViewClient.BASE_URL + "index.html");
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
        if (Build.VERSION.SDK_INT >= 33) {
            settings.setAlgorithmicDarkeningAllowed(false);
        }
        view.setVerticalScrollBarEnabled(true);
        view.setHorizontalScrollBarEnabled(false);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
        if (pendingBubble && Settings.canDrawOverlays(this)) {
            pendingBubble = false;
            startOverlayService();
        }
        if (OverlayService.isRunning()) {
            try {
                startService(new Intent(this, OverlayService.class).setAction(OverlayService.ACTION_COLLAPSE));
            } catch (RuntimeException ignored) {
                // The service may be stopping at the same moment.
            }
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putBoolean(STATE_PENDING_BUBBLE, pendingBubble);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidCoach");
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) {
                Toast.makeText(this, R.string.notification_hint, Toast.LENGTH_LONG).show();
            }
        }
    }

    private void startOverlayService() {
        if (!Settings.canDrawOverlays(this)) {
            requestOverlayPermission();
            return;
        }
        if (!OverlayService.isRunning()) {
            try {
                startForegroundService(new Intent(this, OverlayService.class));
                Toast.makeText(this, R.string.overlay_ready, Toast.LENGTH_SHORT).show();
            } catch (RuntimeException error) {
                Toast.makeText(this, R.string.overlay_error, Toast.LENGTH_LONG).show();
            }
        }
        requestNotificationPermission();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
        }
    }

    private void requestOverlayPermission() {
        pendingBubble = true;
        Toast.makeText(this, R.string.overlay_permission, Toast.LENGTH_LONG).show();
        try {
            startActivity(new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName())
            ));
        } catch (Exception first) {
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
            } catch (Exception second) {
                try {
                    startActivity(new Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName())
                    ));
                } catch (Exception third) {
                    Toast.makeText(this, R.string.overlay_permission, Toast.LENGTH_LONG).show();
                }
            }
        }
    }

    private void stopOverlayService() {
        stopService(new Intent(this, OverlayService.class));
        Toast.makeText(this, R.string.overlay_stopped, Toast.LENGTH_SHORT).show();
    }

    private final class CoachBridge {

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        @JavascriptInterface
        public boolean hasOverlayPermission() {
            return Settings.canDrawOverlays(MainActivity.this);
        }

        @JavascriptInterface
        public boolean isBubbleRunning() {
            return OverlayService.isRunning();
        }

        @JavascriptInterface
        public void toggleBubble() {
            runOnUiThread(() -> {
                if (OverlayService.isRunning()) stopOverlayService();
                else startOverlayService();
            });
        }

        @JavascriptInterface
        public void startBubble() {
            runOnUiThread(MainActivity.this::startOverlayService);
        }

        @JavascriptInterface
        public void stopBubble() {
            runOnUiThread(MainActivity.this::stopOverlayService);
        }

        @JavascriptInterface
        public String readOverlayState() {
            return SharedState.readOverlay(MainActivity.this);
        }

        @JavascriptInterface
        public void publishMainState(String json) {
            SharedState.writeMain(MainActivity.this, json);
        }

        @JavascriptInterface
        public void speak(String text) {
            TtsEngine.speak(MainActivity.this, text);
        }

        @JavascriptInterface
        public void stopSpeaking() {
            TtsEngine.stop();
        }

        @JavascriptInterface
        public void beep(String kind) {
            NativeAlert.beep(MainActivity.this, kind);
        }
    }
}
