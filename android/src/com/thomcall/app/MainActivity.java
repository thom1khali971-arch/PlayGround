package com.thomcall.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    public static MainActivity instance;

    private static final int REQ_MEDIA = 41;
    private static final int REQ_OVERLAY = 42;
    private static final int REQ_PICK_FILE = 43;
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://appassets.androidplatform.net/index.html";

    private FrameLayout root;
    private FrameLayout loadingView;
    private WebView webView;
    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> pendingFileChooser;
    private boolean overlayAfterPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                view.setPadding(0, insets.getSystemWindowInsetTop(), 0, insets.getSystemWindowInsetBottom());
                return insets;
            }
        });
        setContentView(root);
        createLoadingView();

        if (!OverlayService.isActive()) createWebView();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (OverlayService.isActive()) {
            OverlayService.restoreTo(this);
            if (webView == null) createWebView();
        }
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
            webView.requestLayout();
            webView.invalidate();
        }
    }

    @Override
    protected void onDestroy() {
        if (instance == this) instance = null;
        if (!OverlayService.isActive() && webView != null) {
            if (webView.getParent() instanceof ViewGroup) {
                ((ViewGroup) webView.getParent()).removeView(webView);
            }
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK_FILE) {
            if (pendingFileChooser == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    result = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        result[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            pendingFileChooser.onReceiveValue(result);
            pendingFileChooser = null;
            return;
        }
        if (requestCode == REQ_OVERLAY) {
            boolean granted = hasOverlayPermission();
            evaluateJavascript("window.thomNativeOverlayPermission&&window.thomNativeOverlayPermission(" + granted + ")");
            if (granted && overlayAfterPermission) startOverlay();
            overlayAfterPermission = false;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MEDIA || pendingPermissionRequest == null) return;
        List<String> grantedResources = new ArrayList<>();
        for (String resource : pendingPermissionRequest.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                    && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                grantedResources.add(resource);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                grantedResources.add(resource);
            }
        }
        if (grantedResources.isEmpty()) pendingPermissionRequest.deny();
        else pendingPermissionRequest.grant(grantedResources.toArray(new String[0]));
        pendingPermissionRequest = null;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void createLoadingView() {
        loadingView = new FrameLayout(this);
        loadingView.setBackgroundColor(Color.rgb(7, 9, 14));
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        ProgressBar progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        TextView text = new TextView(this);
        text.setText("Voltando ao Thom Call…");
        text.setTextColor(0xFFA4ADC2);
        text.setTextSize(13);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        textParams.topMargin = dp(14);
        box.addView(progress, new LinearLayout.LayoutParams(dp(34), dp(34)));
        box.addView(text, textParams);
        FrameLayout.LayoutParams boxParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        boxParams.gravity = Gravity.CENTER;
        loadingView.addView(box, boxParams);
        loadingView.setVisibility(View.GONE);
        root.addView(loadingView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    public void showRestoreLoading() {
        if (loadingView == null) return;
        loadingView.setVisibility(View.VISIBLE);
        loadingView.bringToFront();
    }

    public void hideRestoreLoading() {
        if (loadingView != null) loadingView.setVisibility(View.GONE);
    }

    private void createWebView() {
        if (webView != null) return;
        WebView view = new WebView(this);
        view.setBackgroundColor(Color.BLACK);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setUserAgentString(settings.getUserAgentString() + " ThomCallAndroid/1.5.1");
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        view.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView target, WebResourceRequest request) {
                return assetResponse(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView target, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (APP_HOST.equals(uri.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        handleMediaPermission(request);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView target, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }
                pendingFileChooser = callback;
                Intent intent = null;
                try {
                    intent = params.createIntent();
                } catch (Exception ignored) {
                }
                if (intent == null) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "Escolher foto"), REQ_PICK_FILE);
                    return true;
                } catch (Exception error) {
                    pendingFileChooser = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        view.addJavascriptInterface(new NativeBridge(), "ThomAndroid");
        webView = view;
        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        view.loadUrl(APP_URL);
    }

    private void handleMediaPermission(PermissionRequest request) {
        boolean needsCamera = false;
        boolean needsMic = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) needsCamera = true;
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) needsMic = true;
        }
        List<String> missing = new ArrayList<>();
        if (needsCamera && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.CAMERA);
        }
        if (needsMic && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            missing.add(Manifest.permission.RECORD_AUDIO);
        }
        if (!missing.isEmpty()) {
            pendingPermissionRequest = request;
            requestPermissions(missing.toArray(new String[0]), REQ_MEDIA);
            return;
        }
        request.grant(request.getResources());
    }

    public WebView detachWebView() {
        if (webView != null && webView.getParent() instanceof ViewGroup) {
            ((ViewGroup) webView.getParent()).removeView(webView);
        }
        return webView;
    }

    public void attachWebView(WebView view) {
        if (view == null) return;
        if (webView != null && webView != view && webView.getParent() instanceof ViewGroup) {
            ((ViewGroup) webView.getParent()).removeView(webView);
        }
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
        webView = view;
        root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (loadingView != null && loadingView.getVisibility() == View.VISIBLE) {
            loadingView.bringToFront();
        }
        view.setVisibility(View.VISIBLE);
        view.onResume();
        view.resumeTimers();
        view.requestLayout();
        view.invalidate();
        if (loadingView != null && loadingView.getVisibility() == View.VISIBLE) {
            view.postVisualStateCallback(SystemClock.uptimeMillis(), new WebView.VisualStateCallback() {
                @Override
                public void onComplete(long requestId) {
                    hideRestoreLoading();
                }
            });
            view.postDelayed(new Runnable() {
                @Override
                public void run() {
                    hideRestoreLoading();
                }
            }, 5000);
        }
        root.post(new Runnable() {
            @Override
            public void run() {
                view.requestLayout();
                view.invalidate();
                root.invalidate();
            }
        });
    }

    public boolean hasOverlayPermission() {
        return Settings.canDrawOverlays(this);
    }

    public void requestOverlayPermission() {
        overlayAfterPermission = true;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, REQ_OVERLAY);
        } catch (Exception error) {
            overlayAfterPermission = false;
            try {
                startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION), REQ_OVERLAY);
            } catch (Exception ignored) {
            }
        }
    }

    public void startOverlay() {
        if (!hasOverlayPermission()) {
            requestOverlayPermission();
            return;
        }
        Intent intent = new Intent(this, OverlayService.class);
        intent.setAction(OverlayService.ACTION_SHOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent);
        else startService(intent);
    }

    public void stopOverlay() {
        stopService(new Intent(this, OverlayService.class));
    }

    private void evaluateJavascript(String script) {
        if (webView != null) webView.evaluateJavascript(script, null);
    }

    private WebResourceResponse assetResponse(Uri uri) {
        if (uri == null || !APP_HOST.equals(uri.getHost())) return null;
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.contains("..")) return textResponse(403, "Forbidden");
        try {
            InputStream stream = getAssets().open("www" + path);
            return new WebResourceResponse(mimeType(path), "UTF-8", stream);
        } catch (IOException error) {
            return textResponse(404, "Not found");
        }
    }

    private WebResourceResponse textResponse(int status, String text) {
        WebResourceResponse response = new WebResourceResponse("text/plain", "UTF-8",
                new ByteArrayInputStream(text.getBytes(StandardCharsets.UTF_8)));
        response.setStatusCodeAndReasonPhrase(status, status == 404 ? "Not Found" : "Forbidden");
        return response;
    }

    private String mimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".woff2")) return "font/woff2";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed == null ? "application/octet-stream" : guessed;
    }

    public class NativeBridge {
        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public String version() {
            return "1.5.1";
        }

        @JavascriptInterface
        public boolean hasOverlayPermission() {
            return MainActivity.this.hasOverlayPermission();
        }

        @JavascriptInterface
        public boolean isOverlayActive() {
            return OverlayService.isActive();
        }

        @JavascriptInterface
        public void requestOverlayPermission() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.requestOverlayPermission();
                }
            });
        }

        @JavascriptInterface
        public void startOverlay() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.startOverlay();
                }
            });
        }

        @JavascriptInterface
        public void stopOverlay() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.stopOverlay();
                }
            });
        }
    }
}
