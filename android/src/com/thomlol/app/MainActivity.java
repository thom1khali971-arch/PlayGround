package com.thomlol.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.Toast;

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
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + APP_HOST + "/index.html";
    private static final String SHARE_URL = "https://thom.lol";

    private static final int REQ_FILE = 1001;
    private static final int REQ_CAMERA = 1002;
    private static final int REQ_VIDEO = 1003;
    private static final int REQ_SHARE_FILES = 1006;

    private static final int REQ_PERM_CAMERA = 2001;
    private static final int REQ_PERM_AUDIO = 2002;

    private WebView webView;

    private ValueCallback<Uri[]> filePathCallback;
    private Uri pendingCameraUri;
    private File pendingCameraFile;

    private MediaRecorder recorder;
    private File recorderFile;
    private AlertDialog recorderDialog;

    private Runnable pendingAction;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(5, 5, 9));
        window.setNavigationBarColor(Color.rgb(5, 5, 9));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(5, 5, 9));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 5, 9));
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        ImageButton shareButton = new ImageButton(this);
        shareButton.setImageResource(R.drawable.ic_share);
        shareButton.setBackgroundResource(R.drawable.bg_share_button);
        shareButton.setColorFilter(Color.WHITE);
        shareButton.setContentDescription("Compartilhar e enviar arquivos");
        int buttonSize = dp(52);
        FrameLayout.LayoutParams buttonParams = new FrameLayout.LayoutParams(buttonSize, buttonSize);
        buttonParams.gravity = Gravity.BOTTOM | Gravity.END;
        buttonParams.setMargins(0, 0, dp(16), dp(20));
        shareButton.setLayoutParams(buttonParams);
        shareButton.setOnClickListener(v -> showShareMenu());
        root.addView(shareButton);

        setContentView(root);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        }
        if (webView.getUrl() == null) {
            webView.loadUrl(START_URL);
        }
    }

    private void configureWebView() {
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
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        CookieManager.getInstance().setAcceptCookie(true);

        webView.addJavascriptInterface(new NativeBridge(), "ThomLolNative");

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) ->
                enqueueDownload(url, userAgent, contentDisposition, mimetype));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && APP_HOST.equals(uri.getHost())) {
                    return serveAsset(uri, request.getRequestHeaders());
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return false;
                if (APP_HOST.equals(uri.getHost())) return false;

                String scheme = uri.getScheme();
                if (scheme == null) return false;
                String lower = scheme.toLowerCase(Locale.ROOT);
                if ("about".equals(lower) || "data".equals(lower) || "blob".equals(lower)) {
                    return false;
                }
                if ("javascript".equals(lower)) {
                    return true;
                }
                openExternally(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript(HOOK_SCRIPT, null);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                showFileChooser(callback, params);
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (request == null) return;
                List<String> granted = new ArrayList<>();
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                                == PackageManager.PERMISSION_GRANTED) {
                            granted.add(resource);
                        }
                    } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        if (checkSelfPermission(Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED) {
                            granted.add(resource);
                        }
                    } else {
                        granted.add(resource);
                    }
                }
                if (granted.isEmpty()) {
                    request.deny();
                } else {
                    request.grant(granted.toArray(new String[0]));
                }
            }
        });
    }

    private void showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
        }
        filePathCallback = callback;

        String[] acceptTypes = params != null ? params.getAcceptTypes() : null;
        boolean multiple = params != null
                && params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        boolean images = accepts(acceptTypes, "image");
        boolean audio = accepts(acceptTypes, "audio");
        boolean video = accepts(acceptTypes, "video");
        boolean any = acceptTypes == null || acceptTypes.length == 0
                || accepts(acceptTypes, "*/*");

        if (!images && !audio && !video && !any) {
            launchOpenDocument(acceptTypes, multiple, firstMimeType(acceptTypes));
            return;
        }

        List<String> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();

        if (images || any) {
            labels.add("Fotos da galeria");
            actions.add(() -> launchOpenDocument(new String[]{"image/*"}, multiple, "image/*"));
            labels.add("Tirar foto com a câmera");
            actions.add(() -> runWithPermission(
                    Manifest.permission.CAMERA, REQ_PERM_CAMERA, this::launchCamera));
        }
        if (video || any) {
            labels.add("Vídeos da galeria");
            actions.add(() -> launchOpenDocument(new String[]{"video/*"}, multiple, "video/*"));
            labels.add("Gravar vídeo");
            actions.add(() -> runWithPermission(
                    Manifest.permission.CAMERA, REQ_PERM_CAMERA, this::launchVideo));
        }
        if (audio || any) {
            labels.add("Áudios e músicas");
            actions.add(() -> launchOpenDocument(new String[]{"audio/*"}, multiple, "audio/*"));
            labels.add("Gravar áudio");
            actions.add(() -> runWithPermission(
                    Manifest.permission.RECORD_AUDIO, REQ_PERM_AUDIO, this::startRecording));
        }
        labels.add("Todos os arquivos");
        actions.add(() -> launchOpenDocument(null, multiple, "*/*"));

        new AlertDialog.Builder(this)
                .setTitle("Enviar arquivo")
                .setItems(labels.toArray(new String[0]), (dialog, which) -> actions.get(which).run())
                .setOnCancelListener(dialog -> failFileChooser())
                .show();
    }

    private static boolean accepts(String[] acceptTypes, String prefix) {
        if (acceptTypes == null) return false;
        for (String type : acceptTypes) {
            if (type == null) continue;
            String value = type.trim().toLowerCase(Locale.ROOT);
            if ("*/*".equals(value) || value.startsWith(prefix + "/")) return true;
        }
        return false;
    }

    private static String firstMimeType(String[] acceptTypes) {
        List<String> mimeTypes = cleanMimeTypes(acceptTypes);
        return mimeTypes.isEmpty() ? "*/*" : mimeTypes.get(0);
    }

    private static List<String> cleanMimeTypes(String[] acceptTypes) {
        List<String> result = new ArrayList<>();
        if (acceptTypes == null) return result;
        for (String accept : acceptTypes) {
            if (accept == null) continue;
            for (String part : accept.split(",")) {
                String value = part.trim();
                if (value.contains("/") && !value.startsWith(".")) result.add(value);
            }
        }
        return result;
    }

    private void launchOpenDocument(String[] acceptTypes, boolean multiple, String type) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);

        if ("*/*".equals(type) && acceptTypes != null) {
            List<String> mimeTypes = cleanMimeTypes(acceptTypes);
            if (!mimeTypes.isEmpty()) {
                intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
            }
        }
        if (multiple) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            startActivityForResult(intent, REQ_FILE);
        } catch (ActivityNotFoundException e) {
            toast("Nenhum gerenciador de arquivos disponível.");
            failFileChooser();
        }
    }

    private void launchCamera() {
        try {
            File file = newMediaFile("photo_", ".jpg");
            Uri uri = MediaFileProvider.getUriForFile(this, file);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);

            if (intent.resolveActivity(getPackageManager()) == null) {
                toast("Nenhum app de câmera disponível.");
                failFileChooser();
                return;
            }

            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.setClipData(ClipData.newRawUri("", uri));
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            grantToIntentTargets(intent, uri);

            pendingCameraUri = uri;
            pendingCameraFile = file;
            startActivityForResult(intent, REQ_CAMERA);
        } catch (Exception e) {
            toast("Não foi possível abrir a câmera.");
            failFileChooser();
        }
    }

    private void launchVideo() {
        try {
            File file = newMediaFile("video_", ".mp4");
            Uri uri = MediaFileProvider.getUriForFile(this, file);
            Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);

            if (intent.resolveActivity(getPackageManager()) == null) {
                toast("Nenhum app de câmera disponível.");
                failFileChooser();
                return;
            }

            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1);
            intent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 120);
            intent.setClipData(ClipData.newRawUri("", uri));
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            grantToIntentTargets(intent, uri);

            pendingCameraUri = uri;
            pendingCameraFile = file;
            startActivityForResult(intent, REQ_VIDEO);
        } catch (Exception e) {
            toast("Não foi possível abrir a câmera.");
            failFileChooser();
        }
    }

    private void grantToIntentTargets(Intent intent, Uri uri) {
        List<ResolveInfo> targets = getPackageManager()
                .queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo target : targets) {
            if (target.activityInfo == null) continue;
            grantUriPermission(
                    target.activityInfo.packageName,
                    uri,
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                            | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
    }

    private File newMediaFile(String prefix, String suffix) throws IOException {
        File dir = new File(getCacheDir(), "media");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Could not create media directory");
        }
        return File.createTempFile(prefix, suffix, dir);
    }

    private void startRecording() {
        if (recorder != null) return;

        try {
            recorderFile = newMediaFile("audio_", ".m4a");
            MediaRecorder mediaRecorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    ? new MediaRecorder(this)
                    : new MediaRecorder();
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setOutputFile(recorderFile.getAbsolutePath());
            mediaRecorder.prepare();
            mediaRecorder.start();
            recorder = mediaRecorder;

            recorderDialog = new AlertDialog.Builder(this)
                    .setTitle("Gravando áudio")
                    .setMessage("Fale ou reproduza o som. Toque em PARAR para enviar a gravação.")
                    .setPositiveButton("Parar e enviar", (dialog, which) -> stopRecording(true))
                    .setNegativeButton("Cancelar", (dialog, which) -> stopRecording(false))
                    .setCancelable(false)
                    .show();
        } catch (Exception e) {
            releaseRecorder();
            if (recorderFile != null) {
                recorderFile.delete();
                recorderFile = null;
            }
            toast("Não foi possível iniciar a gravação.");
            failFileChooser();
        }
    }

    private void stopRecording(boolean keep) {
        boolean success = false;
        if (recorder != null) {
            try {
                recorder.stop();
                success = true;
            } catch (RuntimeException ignored) {
                success = false;
            }
            releaseRecorder();
        }
        if (recorderDialog != null) {
            recorderDialog.dismiss();
            recorderDialog = null;
        }

        File file = recorderFile;
        recorderFile = null;

        if (keep && success && file != null && file.length() > 0) {
            Uri uri = MediaFileProvider.getUriForFile(this, file);
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(new Uri[]{uri});
                filePathCallback = null;
            }
        } else {
            if (file != null) file.delete();
            failFileChooser();
        }
    }

    private void releaseRecorder() {
        if (recorder != null) {
            try {
                recorder.reset();
            } catch (RuntimeException ignored) {
            }
            try {
                recorder.release();
            } catch (RuntimeException ignored) {
            }
            recorder = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE
                || requestCode == REQ_CAMERA
                || requestCode == REQ_VIDEO) {
            List<Uri> results = new ArrayList<>();
            File cameraFile = pendingCameraFile;
            boolean usedCameraOutput = false;
            if (resultCode == RESULT_OK) {
                if (cameraFile != null
                        && cameraFile.length() > 0
                        && pendingCameraUri != null) {
                    results.add(pendingCameraUri);
                    usedCameraOutput = true;
                } else if (data != null) {
                    ClipData clip = data.getClipData();
                    if (clip != null) {
                        for (int i = 0; i < clip.getItemCount(); i++) {
                            Uri uri = clip.getItemAt(i).getUri();
                            if (uri != null) results.add(uri);
                        }
                    }
                    if (data.getData() != null) {
                        results.add(data.getData());
                    }
                }
            }
            if (cameraFile != null && !usedCameraOutput) {
                cameraFile.delete();
            }
            pendingCameraUri = null;
            pendingCameraFile = null;

            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(
                        results.isEmpty() ? null : results.toArray(new Uri[0]));
                filePathCallback = null;
            }
            return;
        }

        if (requestCode == REQ_SHARE_FILES) {
            if (resultCode == RESULT_OK && data != null) {
                List<Uri> results = new ArrayList<>();
                ClipData clip = data.getClipData();
                if (clip != null) {
                    for (int i = 0; i < clip.getItemCount(); i++) {
                        Uri uri = clip.getItemAt(i).getUri();
                        if (uri != null) results.add(uri);
                    }
                }
                if (data.getData() != null) results.add(data.getData());
                shareUris(results);
            }
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    private void runWithPermission(String permission, int requestCode, Runnable action) {
        if (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) {
            action.run();
            return;
        }
        pendingAction = action;
        requestPermissions(new String[]{permission}, requestCode);
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        boolean granted = grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        Runnable action = pendingAction;
        pendingAction = null;

        if (granted && action != null) {
            action.run();
        } else if (requestCode == REQ_PERM_CAMERA || requestCode == REQ_PERM_AUDIO) {
            toast("Permissão necessária para continuar.");
            failFileChooser();
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    private void failFileChooser() {
        if (filePathCallback != null) {
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
        }
    }

    private void showShareMenu() {
        String[] items = new String[]{
                "Compartilhar perfil (link)",
                "Enviar fotos, vídeos, áudios e arquivos",
                "Enviar um link",
                "Abrir thom.lol no navegador",
                "Recarregar app"
        };
        new AlertDialog.Builder(this)
                .setTitle("Thom.Lol")
                .setItems(items, (dialog, which) -> {
                    if (which == 0) {
                        shareText(SHARE_URL);
                    } else if (which == 1) {
                        pickFilesToShare();
                    } else if (which == 2) {
                        showLinkDialog();
                    } else if (which == 3) {
                        openExternally(Uri.parse(SHARE_URL));
                    } else {
                        webView.reload();
                    }
                })
                .show();
    }

    private void pickFilesToShare() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(intent, REQ_SHARE_FILES);
        } catch (ActivityNotFoundException e) {
            toast("Nenhum gerenciador de arquivos disponível.");
        }
    }

    private void shareUris(List<Uri> uris) {
        if (uris == null || uris.isEmpty()) return;

        Intent intent;
        if (uris.size() == 1) {
            intent = new Intent(Intent.ACTION_SEND);
            intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
        } else {
            intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
            intent.putParcelableArrayListExtra(
                    Intent.EXTRA_STREAM, new ArrayList<>(uris));
        }
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(Intent.createChooser(intent, "Enviar com"));
        } catch (ActivityNotFoundException e) {
            toast("Nenhum app disponível para enviar arquivos.");
        }
    }

    private void shareText(String text) {
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, "Thom.Lol");
        intent.putExtra(Intent.EXTRA_TEXT, text);
        try {
            startActivity(Intent.createChooser(intent, "Compartilhar com"));
        } catch (ActivityNotFoundException e) {
            toast("Nenhum app disponível para compartilhar.");
        }
    }

    private void showLinkDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(SHARE_URL);
        input.setSelection(input.getText().length());

        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(20);
        wrapper.setPadding(padding, dp(8), padding, 0);
        wrapper.addView(input, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        new AlertDialog.Builder(this)
                .setTitle("Enviar link")
                .setView(wrapper)
                .setPositiveButton("Enviar", (dialog, which) -> {
                    String value = input.getText().toString().trim();
                    if (!value.isEmpty()) shareText(value);
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void enqueueDownload(
            String url, String userAgent, String contentDisposition, String mimetype) {
        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimetype);
            if (fileName == null || fileName.trim().isEmpty()) {
                fileName = "thomlol-arquivo";
            }

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimetype);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
            request.setTitle(fileName);
            request.setDescription("Baixando do Thom.Lol");
            request.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);

            File publicDir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "ThomLol");
            try {
                request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS, "ThomLol/" + fileName);
            } catch (Exception e) {
                File appDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (appDir == null) appDir = getFilesDir();
                File target = new File(appDir, fileName);
                request.setDestinationUri(Uri.fromFile(target));
            }

            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                toast("Baixando " + fileName);
            } else {
                toast("Não foi possível baixar este arquivo.");
            }
        } catch (Exception e) {
            toast("Não foi possível baixar este arquivo.");
        }
    }

    private class NativeBridge {
        @JavascriptInterface
        public void openExternal(final String url) {
            runOnUiThread(() -> {
                try {
                    openExternally(Uri.parse(url));
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void saveBase64(final String data, final String name, final String mime) {
            new Thread(() -> saveBlob(data, name, mime)).start();
        }
    }

    private void saveBlob(String data, String name, String mime) {
        String safeName = sanitizeFileName(name);
        if (safeName.isEmpty()) safeName = "thomlol-arquivo";
        String safeMime = mime == null || mime.isEmpty()
                ? "application/octet-stream"
                : mime;

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, safeMime);
                values.put(
                        MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/ThomLol");
                Uri uri = getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("MediaStore insert failed");
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(bytes);
                }
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = getFilesDir();
                if (!dir.exists()) dir.mkdirs();
                File target = new File(dir, safeName);
                try (FileOutputStream output = new FileOutputStream(target)) {
                    output.write(bytes);
                }
            }
            runOnUiThread(() -> toast("Arquivo salvo em Downloads/ThomLol."));
        } catch (Exception e) {
            runOnUiThread(() -> toast("Não foi possível salvar o arquivo."));
        }
    }

    private static String sanitizeFileName(String name) {
        if (name == null) return "";
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    private void openExternally(Uri uri) {
        if (uri == null) return;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            toast("Nenhum app disponível para abrir este link.");
        } catch (Exception e) {
            toast("Não foi possível abrir este link.");
        }
    }

    private WebResourceResponse serveAsset(Uri uri, Map<String, String> requestHeaders) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) {
            path = "/index.html";
        }
        if (path.contains("..")) {
            return errorResponse(404, "Not found");
        }

        String assetPath = path.startsWith("/") ? path.substring(1) : path;
        byte[] data;
        AssetManager assets = getAssets();
        try (InputStream input = assets.open(assetPath);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            data = output.toByteArray();
        } catch (IOException e) {
            return errorResponse(404, "Not found");
        }

        String mime = mimeType(assetPath);
        String encoding = isTextMime(mime) ? "UTF-8" : null;
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        headers.put("Accept-Ranges", "bytes");
        headers.put("Content-Type", mime);

        int start = 0;
        int end = data.length - 1;
        boolean partial = false;
        String range = requestHeaders != null ? requestHeaders.get("Range") : null;
        if (range != null && range.startsWith("bytes=") && data.length > 0) {
            try {
                String value = range.substring(6).split(",")[0].trim();
                int dash = value.indexOf('-');
                if (dash >= 0) {
                    String startValue = value.substring(0, dash).trim();
                    String endValue = value.substring(dash + 1).trim();
                    if (!startValue.isEmpty()) {
                        start = Integer.parseInt(startValue);
                    }
                    if (!endValue.isEmpty()) {
                        end = Math.min(Integer.parseInt(endValue), data.length - 1);
                    }
                    if (start < 0 || start >= data.length || end < start) {
                        return errorResponse(416, "Range Not Satisfiable");
                    }
                    partial = true;
                }
            } catch (NumberFormatException ignored) {
                start = 0;
                end = data.length - 1;
                partial = false;
            }
        }

        if (partial) {
            headers.put("Content-Range",
                    "bytes " + start + "-" + end + "/" + data.length);
            headers.put("Content-Length", String.valueOf(end - start + 1));
            return new WebResourceResponse(
                    mime, encoding, 206, "Partial Content", headers,
                    new ByteArrayInputStream(data, start, end - start + 1));
        }

        headers.put("Content-Length", String.valueOf(data.length));
        return new WebResourceResponse(
                mime, encoding, 200, "OK", headers, new ByteArrayInputStream(data));
    }

    private static WebResourceResponse errorResponse(int status, String message) {
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        return new WebResourceResponse(
                "text/plain", "UTF-8", status, message, headers, new ByteArrayInputStream(body));
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
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
        if (lower.endsWith(".m4a") || lower.endsWith(".aac")) return "audio/mp4";
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

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
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
        if (recorder != null) {
            stopRecording(false);
        }
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
        releaseRecorder();
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private static final String HOOK_SCRIPT =
            "(function(){"
                    + "if(window.__thomlolHooked)return;window.__thomlolHooked=true;"
                    + "document.addEventListener('click',function(e){"
                    + "var t=e.target;while(t&&t.tagName!=='A'){t=t.parentElement;}"
                    + "if(!t)return;"
                    + "var h=t.getAttribute('href')||'';"
                    + "if(!h||h.charAt(0)==='#'||h.indexOf('javascript:')===0)return;"
                    + "try{var u=new URL(h,location.href);"
                    + "if(u.host===location.host)return;"
                    + "if(!/^(https?|mailto|tel|sms|intent):$/i.test(u.protocol))return;"
                    + "e.preventDefault();e.stopPropagation();"
                    + "if(window.ThomLolNative)window.ThomLolNative.openExternal(u.href);"
                    + "}catch(err){}"
                    + "},true);"
                    + "var oc=HTMLAnchorElement.prototype.click;"
                    + "HTMLAnchorElement.prototype.click=function(){"
                    + "try{var h=this.href||'';"
                    + "if(this.hasAttribute('download')&&h.indexOf('blob:')===0&&window.ThomLolNative){"
                    + "var n=this.getAttribute('download')||'thomlol-arquivo';"
                    + "fetch(h).then(function(r){return r.blob();}).then(function(b){"
                    + "var fr=new FileReader();fr.onload=function(){"
                    + "var s=String(fr.result||'');var i=s.indexOf(',');"
                    + "window.ThomLolNative.saveBase64(i>=0?s.substring(i+1):'',n,"
                    + "b.type||'application/octet-stream');};"
                    + "fr.readAsDataURL(b);});return;}"
                    + "}catch(err){}"
                    + "return oc.apply(this,arguments);};"
                    + "})();";
}
