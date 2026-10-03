package com.edward.dogcare;

import android.content.Context;

import com.google.mediapipe.tasks.genai.llminference.LlmInference;

import org.json.JSONObject;

import java.io.File;

/**
 * IA local opcional (Gemma via MediaPipe LLM Inference).
 * Procura o modelo na pasta interna do app ou em Android/data/com.edward.dogcare/files.
 * Se não houver modelo ou o aparelho não suportar, o app segue funcionando sem IA.
 */
final class LocalAi {

    private static LlmInference llm;
    private static volatile String state = "none";   // none | loading | ready | error
    private static volatile String model = "";
    private static volatile String error = "";

    private LocalAi() { }

    static File modelDir(Context c) {
        File d = new File(c.getFilesDir(), "model");
        d.mkdirs();
        return d;
    }

    private static boolean isModel(File f) {
        String n = f.getName().toLowerCase();
        return f.isFile() && (n.endsWith(".task") || n.endsWith(".litertlm") || n.endsWith(".bin"));
    }

    static File findModel(Context c) {
        File[] dirs = { modelDir(c), c.getExternalFilesDir(null) };
        for (File d : dirs) {
            if (d == null) continue;
            File[] fs = d.listFiles();
            if (fs == null) continue;
            for (File f : fs) if (isModel(f)) return f;
        }
        return null;
    }

    static void removeModels(Context c) {
        File[] fs = modelDir(c).listFiles();
        if (fs != null) for (File f : fs) if (!f.getName().endsWith(".part")) f.delete();
        state = "none";
        model = "";
        error = "";
    }

    static void initAsync(Context c, Runnable done) {
        final Context app = c.getApplicationContext();
        new Thread(() -> { init(app); if (done != null) done.run(); }).start();
    }

    static synchronized void init(Context c) {
        close();
        File f = findModel(c);
        if (f == null) { state = "none"; model = ""; return; }
        state = "loading";
        model = f.getName();
        try {
            LlmInference.LlmInferenceOptions opts = LlmInference.LlmInferenceOptions.builder()
                    .setModelPath(f.getAbsolutePath())
                    .setMaxTokens(2048)
                    .build();
            llm = LlmInference.createFromOptions(c, opts);
            state = "ready";
            error = "";
        } catch (Throwable t) {
            llm = null;
            state = "error";
            error = String.valueOf(t.getMessage());
        }
    }

    static synchronized void close() {
        if (llm != null) {
            try { llm.close(); } catch (Throwable ignored) { }
            llm = null;
        }
    }

    static synchronized String ask(String prompt) throws Exception {
        if (llm == null) throw new IllegalStateException("IA local não está ativa");
        return llm.generateResponse(prompt);
    }

    static String statusJson() {
        try {
            JSONObject o = new JSONObject();
            o.put("state", state);
            o.put("model", model);
            o.put("error", error);
            return o.toString();
        } catch (Exception e) {
            return "{\"state\":\"error\"}";
        }
    }
}
