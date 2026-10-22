package com.grandmasterlab.chess;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String APP_HOST = "grandmasterlab.local";
    private static final String APP_URL = "https://" + APP_HOST + "/index.html";

    private WebView webView;
    private WindowManager windowManager;
    private View overlayView;
    private WebView overlayWebView;
    private WindowManager.LayoutParams overlayParams;
    private boolean pendingOverlayPermission = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#0b0e14"));
        getWindow().setNavigationBarColor(Color.parseColor("#0b0e14"));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        webView = new WebView(this);
        configureWebView(webView, false);
        webView.addJavascriptInterface(new OverlayBridge(), "AndroidOverlay");
        setContentView(webView);

        webView.loadUrl(APP_URL);
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void configureWebView(WebView view, boolean overlay) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        view.setBackgroundColor(Color.parseColor("#0b0e14"));
        view.setWebViewClient(new LocalAssetClient());
        view.setWebChromeClient(new DialogChromeClient());
    }

    private void goBackSmart() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return window.__androidBack?window.__androidBack():false}catch(e){return false}})()",
                value -> {
                    if (!"true".equals(value)) {
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            finish();
                        }
                    }
                });
    }

    @Override
    public void onBackPressed() {
        if (overlayView != null) {
            hideOverlay();
            return;
        }
        goBackSmart();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingOverlayPermission) {
            if (Settings.canDrawOverlays(this)) {
                pendingOverlayPermission = false;
                showOverlay();
            }
        }
    }

    @Override
    protected void onDestroy() {
        hideOverlay();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidOverlay");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // ---------------- sobreposição nativa (SYSTEM_ALERT_WINDOW) ----------------

    private void requestOrShowOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            pendingOverlayPermission = true;
            Toast.makeText(this, R.string.overlay_permission_hint, Toast.LENGTH_LONG).show();
            try {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            } catch (Exception e) {
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION));
                } catch (Exception ignored) {
                    pendingOverlayPermission = false;
                    Toast.makeText(this, "Não foi possível abrir as permissões de sobreposição.", Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        showOverlay();
    }

    private void showOverlay() {
        if (overlayView != null) return;

        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.parseColor("#0b0e14"));
        background.setCornerRadius(dp(18));
        background.setStroke(dp(1), Color.parseColor("#2a3350"));
        container.setBackground(background);
        container.setClipToOutline(true);
        container.setElevation(dp(12));

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(Color.parseColor("#111624"));
        header.setPadding(dp(14), dp(6), dp(6), dp(6));

        TextView title = new TextView(this);
        title.setText("♞  Grandmaster Lab — sobreposição");
        title.setTextColor(Color.parseColor("#eef1ff"));
        title.setTextSize(13f);
        title.setSingleLine(true);
        LinearLayout.LayoutParams titleParams =
                new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(title, titleParams);

        Button close = new Button(this);
        close.setText("✕");
        close.setTextSize(16f);
        close.setTextColor(Color.parseColor("#eef1ff"));
        close.setBackgroundColor(Color.TRANSPARENT);
        close.setPadding(dp(10), 0, dp(10), 0);
        close.setMinWidth(0);
        close.setMinimumWidth(0);
        header.addView(close, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, dp(40)));

        container.addView(header, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(44)));

        overlayWebView = new WebView(this);
        configureWebView(overlayWebView, true);
        container.addView(overlayWebView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        int width = Math.min(dp(560), (int) (screenWidth * 0.94));
        int height = (int) (screenHeight * 0.82);

        overlayParams = new WindowManager.LayoutParams(
                width,
                height,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                android.graphics.PixelFormat.TRANSLUCENT);
        overlayParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        overlayParams.y = dp(48);
        overlayParams.x = 0;

        close.setOnClickListener(v -> hideOverlay());

        header.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = event.getRawX();
                        downY = event.getRawY();
                        startX = overlayParams.x;
                        startY = overlayParams.y;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        overlayParams.x = startX + Math.round(event.getRawX() - downX);
                        overlayParams.y = startY + Math.round(event.getRawY() - downY);
                        try {
                            windowManager.updateViewLayout(container, overlayParams);
                        } catch (Exception ignored) {
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        overlayView = container;
        try {
            windowManager.addView(overlayView, overlayParams);
            overlayWebView.loadUrl(APP_URL + "?overlay=1");
        } catch (Exception e) {
            hideOverlay();
            Toast.makeText(this, "Falha ao abrir a sobreposição: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void hideOverlay() {
        if (overlayWebView != null) {
            overlayWebView.destroy();
            overlayWebView = null;
        }
        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {
            }
            overlayView = null;
        }
    }

    private final class OverlayBridge {
        @JavascriptInterface
        public boolean isSupported() {
            return true;
        }

        @JavascriptInterface
        public boolean isShowing() {
            return overlayView != null;
        }

        @JavascriptInterface
        public void toggle() {
            runOnUiThread(() -> {
                if (overlayView != null) {
                    hideOverlay();
                } else {
                    requestOrShowOverlay();
                }
            });
        }

        @JavascriptInterface
        public void show() {
            runOnUiThread(MainActivity.this::requestOrShowOverlay);
        }

        @JavascriptInterface
        public void hide() {
            runOnUiThread(MainActivity.this::hideOverlay);
        }
    }

    // ---------------- servidor local de assets ----------------

    private WebResourceResponse assetResponse(String name, String mime) {
        try {
            InputStream stream = getAssets().open(name);
            WebResourceResponse response = new WebResourceResponse(mime, "UTF-8", stream);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "no-cache");
            response.setResponseHeaders(headers);
            return response;
        } catch (IOException e) {
            return new WebResourceResponse(
                    "text/plain", "UTF-8",
                    new ByteArrayInputStream((name + " ausente").getBytes()));
        }
    }



    private final class LocalAssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri != null && APP_HOST.equals(uri.getHost())) {
                String path = uri.getPath();
                if (path == null || path.equals("/") || path.equals("/index.html")) {
                    return assetResponse("index.html", "text/html");
                }
                if (path.equals("/stockfish.js")) {
                    return assetResponse("stockfish.js", "application/javascript");
                }
                if (path.equals("/chess.min.js")) {
                    return assetResponse("chess.min.js", "application/javascript");
                }
                return new WebResourceResponse(
                        "text/plain", "UTF-8",
                        new ByteArrayInputStream("Não encontrado".getBytes()));
            }
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri != null && APP_HOST.equals(uri.getHost())) {
                return false;
            }
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(intent);
            } catch (Exception ignored) {
            }
            return true;
        }
    }

    private final class DialogChromeClient extends WebChromeClient {
        @Override
        public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
            return true;
        }

        @Override
        public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                  final JsPromptResult result) {
            final EditText input = new EditText(MainActivity.this);
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
            input.setText(defaultValue == null ? "" : defaultValue);
            new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton("Cancelar", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
            return true;
        }
    }
}
