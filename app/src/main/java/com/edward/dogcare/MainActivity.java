package com.edward.dogcare;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.speech.RecognizerIntent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class MainActivity extends Activity {

    static final int REQ_VOICE = 11, REQ_EXPORT = 12, REQ_IMPORT = 13, REQ_FILE = 14, REQ_MODEL = 15, REQ_NOTIF = 16;

    WebView web;
    FrameLayout root;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingExport;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);

        root = new FrameLayout(this);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        root.setBackgroundColor(night ? 0xFF121110 : 0xFFF6F3EE);

        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                return WindowInsets.CONSUMED;
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
                return insets.consumeSystemWindowInsets();
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                openExternal(u.toString());
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent pick = params.createIntent();
                    pick.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(Intent.createChooser(pick, "Escolher imagem"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    cb.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(this), "Android");
        web.loadUrl("file:///android_asset/www/index.html");

        Reminders.reschedule(this);
        LocalAi.initAsync(this, () -> js("window.DC && DC.onAiStatus(" + LocalAi.statusJson() + ")"));
    }

    // ---------- helpers chamados pela ponte ----------

    void js(String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) { }
    }

    void setBars(boolean dark, String bg) {
        runOnUiThread(() -> {
            int c;
            try { c = Color.parseColor(bg); } catch (Exception e) { c = dark ? 0xFF121110 : 0xFFF6F3EE; }
            root.setBackgroundColor(c);
            getWindow().getDecorView().setBackgroundColor(c);
            if (Build.VERSION.SDK_INT >= 30) {
                WindowInsetsController ic = getWindow().getInsetsController();
                if (ic != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    ic.setSystemBarsAppearance(dark ? 0 : mask, mask);
                }
            } else {
                View d = getWindow().getDecorView();
                int f = d.getSystemUiVisibility();
                if (dark) f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                d.setSystemUiVisibility(f);
            }
        });
    }

    void startVoice() {
        runOnUiThread(() -> {
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
            i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Conte o que aconteceu");
            try {
                startActivityForResult(i, REQ_VOICE);
            } catch (ActivityNotFoundException e) {
                js("DC.onVoice(null," + JSONObject.quote("Reconhecimento de voz indisponível neste aparelho") + ")");
            }
        });
    }

    void exportFile(String name, String content) {
        runOnUiThread(() -> {
            pendingExport = content;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("application/json");
            i.putExtra(Intent.EXTRA_TITLE, name);
            startActivityForResult(i, REQ_EXPORT);
        });
    }

    void importFile() {
        runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            startActivityForResult(i, REQ_IMPORT);
        });
    }

    void pickModel() {
        runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            startActivityForResult(i, REQ_MODEL);
        });
    }

    void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
        }
    }

    boolean notificationsAllowed() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    // ---------- resultados ----------

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
                fileCallback = null;
            }
            return;
        }
        if (req == REQ_VOICE) {
            if (res == RESULT_OK && data != null) {
                ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                String t = (r != null && !r.isEmpty()) ? r.get(0) : "";
                js("DC.onVoice(" + JSONObject.quote(t) + ",null)");
            } else {
                js("DC.onVoice(null,null)");
            }
            return;
        }
        Uri uri = (res == RESULT_OK && data != null) ? data.getData() : null;
        if (req == REQ_EXPORT) {
            String content = pendingExport;
            pendingExport = null;
            if (uri == null || content == null) { js("DC.toast('Exportação cancelada')"); return; }
            new Thread(() -> {
                try (OutputStream os = getContentResolver().openOutputStream(uri, "wt")) {
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                    js("DC.toast('Backup salvo')");
                } catch (Exception e) {
                    js("DC.toast(" + JSONObject.quote("Falha ao salvar: " + e.getMessage()) + ")");
                }
            }).start();
            return;
        }
        if (req == REQ_IMPORT) {
            if (uri == null) return;
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(uri)) {
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                    String text = bo.toString("UTF-8");
                    js("DC.onImport(" + JSONObject.quote(text) + ")");
                } catch (Exception e) {
                    js("DC.toast(" + JSONObject.quote("Falha ao ler: " + e.getMessage()) + ")");
                }
            }).start();
            return;
        }
        if (req == REQ_MODEL) {
            if (uri == null) return;
            copyModel(uri);
        }
    }

    private void copyModel(Uri uri) {
        new Thread(() -> {
            String name = "modelo.task";
            long size = -1;
            try (Cursor c = getContentResolver().query(uri, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int si = c.getColumnIndex(OpenableColumns.SIZE);
                    if (ni >= 0) name = c.getString(ni);
                    if (si >= 0) size = c.getLong(si);
                }
            } catch (Exception ignored) { }
            String lower = name.toLowerCase();
            if (!(lower.endsWith(".task") || lower.endsWith(".litertlm") || lower.endsWith(".bin"))) {
                js("DC.toast('Escolha um arquivo de modelo .task ou .litertlm')");
                return;
            }
            File dir = LocalAi.modelDir(this);
            File tmp = new File(dir, name + ".part");
            File dst = new File(dir, name);
            try (InputStream in = getContentResolver().openInputStream(uri);
                 OutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[1 << 20];
                long done = 0;
                int n, last = -1;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    if (size > 0) {
                        int p = (int) (done * 100 / size);
                        if (p != last) { last = p; js("DC.onAiProgress(" + p + ")"); }
                    }
                }
            } catch (Exception e) {
                tmp.delete();
                js("DC.toast(" + JSONObject.quote("Falha ao copiar modelo: " + e.getMessage()) + ")");
                return;
            }
            LocalAi.removeModels(this);
            tmp.renameTo(dst);
            LocalAi.initAsync(this, () -> js("DC.onAiStatus(" + LocalAi.statusJson() + ")"));
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF) js("DC.onNotifPermission(" + notificationsAllowed() + ")");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.DC ? DC.back() : false", v -> {
            if (!"true".equals(v)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        js("window.DC && DC.onResume()");
    }
}
