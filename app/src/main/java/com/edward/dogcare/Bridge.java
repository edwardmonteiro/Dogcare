package com.edward.dogcare;

import android.content.pm.PackageInfo;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Ponte JS ↔ Android. Tudo fica no armazenamento interno do app; nada sai do aparelho. */
public class Bridge {

    private final MainActivity act;
    private final File dataFile;
    private final File photoDir;
    private final ExecutorService aiExec = Executors.newSingleThreadExecutor();

    Bridge(MainActivity act) {
        this.act = act;
        this.dataFile = new File(act.getFilesDir(), "dogcare.json");
        this.photoDir = new File(act.getFilesDir(), "photos");
        photoDir.mkdirs();
    }

    // ---------- dados ----------

    @JavascriptInterface
    public String load() {
        try { return read(dataFile); } catch (IOException e) { return ""; }
    }

    @JavascriptInterface
    public boolean save(String json) {
        try { write(dataFile, json); return true; } catch (IOException e) { return false; }
    }

    @JavascriptInterface
    public boolean savePhoto(String id, String dataUrl) {
        try { write(new File(photoDir, safe(id) + ".txt"), dataUrl); return true; } catch (IOException e) { return false; }
    }

    @JavascriptInterface
    public String getPhoto(String id) {
        try { return read(new File(photoDir, safe(id) + ".txt")); } catch (IOException e) { return ""; }
    }

    @JavascriptInterface
    public void deletePhoto(String id) {
        new File(photoDir, safe(id) + ".txt").delete();
    }

    // ---------- sistema ----------

    @JavascriptInterface
    public void setBars(boolean dark, String bg) { act.setBars(dark, bg); }

    @JavascriptInterface
    public void startVoice() { act.startVoice(); }

    @JavascriptInterface
    public void exportFile(String name, String content) { act.exportFile(name, content); }

    @JavascriptInterface
    public void importFile() { act.importFile(); }

    @JavascriptInterface
    public void openUrl(String url) { act.openExternal(url); }

    @JavascriptInterface
    public void schedule(String json) { Reminders.scheduleAll(act, json); }

    @JavascriptInterface
    public void requestNotifications() { act.requestNotifications(); }

    @JavascriptInterface
    public boolean notificationsAllowed() { return act.notificationsAllowed(); }

    @JavascriptInterface
    public String version() {
        try {
            PackageInfo p = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            return p.versionName;
        } catch (Exception e) { return "?"; }
    }

    // ---------- IA local ----------

    @JavascriptInterface
    public String aiStatus() { return LocalAi.statusJson(); }

    @JavascriptInterface
    public void aiPickModel() { act.pickModel(); }

    @JavascriptInterface
    public void aiRemove() {
        LocalAi.close();
        LocalAi.removeModels(act);
        act.js("DC.onAiStatus(" + LocalAi.statusJson() + ")");
    }

    @JavascriptInterface
    public String aiModelFolder() {
        File f = act.getExternalFilesDir(null);
        return f == null ? "" : f.getAbsolutePath();
    }

    @JavascriptInterface
    public void aiAsk(String reqId, String prompt) {
        aiExec.execute(() -> {
            String out = null, err = null;
            try { out = LocalAi.ask(prompt); } catch (Throwable t) { err = String.valueOf(t.getMessage()); }
            act.js("DC.onAi(" + JSONObject.quote(reqId) + "," + (out == null ? "null" : JSONObject.quote(out))
                    + "," + (err == null ? "null" : JSONObject.quote(err)) + ")");
        });
    }

    // ---------- util ----------

    private static String safe(String id) { return id.replaceAll("[^A-Za-z0-9_-]", "_"); }

    private static String read(File f) throws IOException {
        if (!f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return new String(b, 0, off, StandardCharsets.UTF_8);
        }
    }

    /** Gravação atômica: escreve num temporário e renomeia. */
    private static void write(File f, String s) throws IOException {
        File tmp = new File(f.getParentFile(), f.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(s.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        if (!tmp.renameTo(f)) throw new IOException("rename failed");
    }
}
