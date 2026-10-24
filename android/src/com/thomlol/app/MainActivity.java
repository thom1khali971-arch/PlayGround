package com.thomlol.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.Window;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/index.html";
    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_CREATE_DOCUMENT = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingFileData;
    private String pendingFileName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(5, 5, 9));
        window.setNavigationBarColor(Color.rgb(5, 5, 9));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 9));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.addJavascriptInterface(new WebAppBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_HOST.equals(uri.getHost())) {
                    return serveAsset(uri);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(readAsset("bridge.js"), null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_HOST.equals(uri.getHost())) {
                    return false;
                }
                openExternally(uri);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = callback;

                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileChooserCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this,
                            "Nenhum app disponível para escolher arquivos.",
                            Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(
                    String url, String userAgent, String contentDisposition,
                    String mimeType, long contentLength) {
                if (url.startsWith("blob:") || url.startsWith("data:")) {
                    String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    String script = "fetch(" + JSONObject.quote(url) + ")"
                            + ".then(r=>r.blob())"
                            + ".then(b=>{const fr=new FileReader();"
                            + "fr.onload=()=>{const s=String(fr.result||'');"
                            + "const i=s.indexOf(',');"
                            + "Android.saveFile(" + JSONObject.quote(name) + ","
                            + "b.type||" + JSONObject.quote(mimeType) + ","
                            + "i>=0?s.slice(i+1):'');};fr.readAsDataURL(b);})"
                            + ".catch(()=>{})";
                    webView.evaluateJavascript(script, null);
                    return;
                }
                openExternally(Uri.parse(url));
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        }
        if (webView.getUrl() == null) {
            webView.loadUrl(START_URL);
        }

        setContentView(webView);
    }

    private class WebAppBridge {
        @JavascriptInterface
        public void copyText(String text) {
            final String value = text == null ? "" : text;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    ClipboardManager clipboard =
                            (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(ClipData.newPlainText("Link", value));
                    }
                }
            });
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            final String fileName = sanitizeFileName(name);
            final String mimeType = (mime == null || mime.isEmpty())
                    ? "application/octet-stream" : mime;
            final byte[] data;
            try {
                data = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this,
                                "Não foi possível preparar o arquivo.",
                                Toast.LENGTH_SHORT).show();
                    }
                });
                return;
            }

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingFileData = data;
                    pendingFileName = fileName;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, fileName);
                    try {
                        startActivityForResult(intent, REQ_CREATE_DOCUMENT);
                    } catch (ActivityNotFoundException e) {
                        pendingFileData = null;
                        pendingFileName = null;
                        Toast.makeText(MainActivity.this,
                                "Nenhum app disponível para salvar o arquivo.",
                                Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void toast(String message) {
            final String value = message == null ? "" : message;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, value, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private Uri[] copySelectedToCache(Uri[] sources) {
        if (sources == null || sources.length == 0) return sources;
        File dir = new File(getCacheDir(), "picked");
        if (!dir.exists() && !dir.mkdirs()) return sources;

        long stamp = System.currentTimeMillis();
        File[] oldFiles = dir.listFiles();
        if (oldFiles != null) {
            for (File old : oldFiles) {
                if (stamp - old.lastModified() > 24L * 60L * 60L * 1000L) {
                    old.delete();
                }
            }
        }

        ArrayList<Uri> copied = new ArrayList<>();
        for (int i = 0; i < sources.length; i++) {
            Uri source = sources[i];
            if (source == null) continue;

            String name = queryDisplayName(source);
            if (name == null || name.trim().isEmpty()) {
                name = "arquivo-" + (i + 1);
            }
            name = sanitizeFileName(name);
            String storedName = stamp + "-" + (i + 1) + "-" + name;
            File destination = new File(dir, storedName);
            String mime = getContentResolver().getType(source);

            InputStream input = null;
            OutputStream output = null;
            try {
                input = getContentResolver().openInputStream(source);
                if (input == null) throw new IOException("Could not open selected file");
                output = new FileOutputStream(destination);
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
                output.flush();
                CacheFileProvider.registerType(storedName, mime);
                copied.add(Uri.parse("content://" + CacheFileProvider.AUTHORITY + "/"
                        + Uri.encode(storedName)));
            } catch (IOException | SecurityException e) {
                destination.delete();
                copied.add(source);
            } finally {
                if (input != null) {
                    try {
                        input.close();
                    } catch (IOException ignored) {
                    }
                }
                if (output != null) {
                    try {
                        output.close();
                    } catch (IOException ignored) {
                    }
                }
            }
        }
        return copied.isEmpty() ? sources : copied.toArray(new Uri[0]);
    }

    private String queryDisplayName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                    uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.isEmpty()) return name;
                }
            }
        } catch (Exception ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        return uri.getLastPathSegment();
    }

    private static String sanitizeFileName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "thomlol-arquivo";
        }
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (cleaned.isEmpty()) return "thomlol-arquivo";
        if (cleaned.length() > 120) {
            int dot = cleaned.lastIndexOf('.');
            String extension = (dot > 0 && cleaned.length() - dot <= 12)
                    ? cleaned.substring(dot) : "";
            cleaned = cleaned.substring(0, 120 - extension.length()) + extension;
        }
        return cleaned;
    }

    private String readAsset(String name) {
        try (InputStream input = getAssets().open(name)) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return "";
        }
    }

    private WebResourceResponse serveAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "/index.html";
        }
        if (path.contains("..")) {
            return errorResponse(404, "Not found");
        }

        String assetPath = path.startsWith("/") ? path.substring(1) : path;
        AssetManager assets = getAssets();
        try {
            InputStream input = assets.open(assetPath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            String mime = mimeType(assetPath);
            String encoding = isTextMime(mime) ? "UTF-8" : null;
            return new WebResourceResponse(mime, encoding, 200, "OK", headers, input);
        } catch (IOException e) {
            return errorResponse(404, "Not found");
        }
    }

    private static WebResourceResponse errorResponse(int status, String message) {
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse(
                "text/plain", "UTF-8", status, message, headers, new ByteArrayInputStream(body));
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp4")) return "video/mp4";
        if (lower.endsWith(".webm")) return "video/webm";
        if (lower.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static boolean isTextMime(String mime) {
        return mime.startsWith("text/")
                || "application/javascript".equals(mime)
                || "application/json".equals(mime)
                || "image/svg+xml".equals(mime);
    }

    private void openExternally(Uri uri) {
        if (uri == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            String scheme = uri.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                intent.addCategory(Intent.CATEGORY_BROWSABLE);
            }
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Nenhum app disponível para abrir este link.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER) {
            if (fileChooserCallback == null) {
                super.onActivityResult(requestCode, resultCode, data);
                return;
            }
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    ArrayList<Uri> uris = new ArrayList<>();
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        Uri uri = clipData.getItemAt(i).getUri();
                        if (uri != null) uris.add(uri);
                    }
                    if (!uris.isEmpty()) {
                        results = uris.toArray(new Uri[0]);
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
            results = copySelectedToCache(results);
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
            return;
        }

        if (requestCode == REQ_CREATE_DOCUMENT) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null
                    && pendingFileData != null) {
                OutputStream output = null;
                try {
                    output = getContentResolver().openOutputStream(data.getData());
                    if (output != null) {
                        output.write(pendingFileData);
                        output.flush();
                        Toast.makeText(this,
                                "Arquivo salvo: " + pendingFileName,
                                Toast.LENGTH_SHORT).show();
                    }
                } catch (IOException e) {
                    Toast.makeText(this,
                            "Não foi possível salvar o arquivo.",
                            Toast.LENGTH_SHORT).show();
                } finally {
                    if (output != null) {
                        try {
                            output.close();
                        } catch (IOException ignored) {
                        }
                    }
                }
            }
            pendingFileData = null;
            pendingFileName = null;
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        webView.evaluateJavascript(
                "(function(){"
                        + "var o=document.querySelector('.overlay,[role=\"dialog\"]');"
                        + "if(o){document.dispatchEvent(new KeyboardEvent('keydown',"
                        + "{key:'Escape',code:'Escape',bubbles:true,cancelable:true}));return true;}"
                        + "return false;})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) {
                            return;
                        }
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            MainActivity.super.onBackPressed();
                        }
                    }
                });
    }
}
