package com.edward.dogcare;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/** Agenda os lembretes calculados pelo app (vacinas, antiparasitários, remédios). */
final class Reminders {

    private Reminders() { }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("reminders", Context.MODE_PRIVATE);
    }

    private static PendingIntent pi(Context c, String id, String title, String body) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.setAction("com.edward.dogcare.REMINDER." + id);
        i.putExtra("id", id);
        i.putExtra("title", title);
        i.putExtra("body", body);
        return PendingIntent.getBroadcast(c, id.hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static synchronized void scheduleAll(Context c, String json) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences p = prefs(c);
        try {
            JSONArray old = new JSONArray(p.getString("json", "[]"));
            for (int k = 0; k < old.length(); k++) {
                JSONObject o = old.getJSONObject(k);
                am.cancel(pi(c, o.optString("id"), o.optString("title"), o.optString("body")));
            }
        } catch (Exception ignored) { }
        long now = System.currentTimeMillis();
        JSONArray keep = new JSONArray();
        try {
            JSONArray arr = new JSONArray(json == null ? "[]" : json);
            for (int k = 0; k < arr.length() && keep.length() < 200; k++) {
                JSONObject o = arr.getJSONObject(k);
                long at = o.optLong("at");
                if (at <= now) continue;
                String id = o.optString("id");
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at,
                        pi(c, id, o.optString("title"), o.optString("body")));
                keep.put(o);
            }
        } catch (Exception ignored) { }
        p.edit().putString("json", keep.toString()).apply();
    }

    static void reschedule(Context c) {
        scheduleAll(c, prefs(c).getString("json", "[]"));
    }
}
