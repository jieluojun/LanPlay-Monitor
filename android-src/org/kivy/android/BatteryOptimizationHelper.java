package org.kivy.android;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
public class BatteryOptimizationHelper {
    private static final String TAG = "BatteryOpt";
    private static final String PREF = "battery_opt_prefs";
    private static final String KEY_PROMPTED = "prompted";
    public static boolean requestIgnoreBatteryOptimizationsIfNeeded(Activity activity) {
        try {
            if (activity == null) return false;
            PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
            if (pm == null) return false;
            String pkg = activity.getPackageName();
            if (pm.isIgnoringBatteryOptimizations(pkg)) {
                Log.i(TAG, "Already ignoring battery optimizations");
                return false;
            }
            SharedPreferences sp = activity.getSharedPreferences(PREF, Context.MODE_PRIVATE);
            if (sp.getBoolean(KEY_PROMPTED, false)) {
                Log.i(TAG, "Already prompted before, skip");
                return false;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    activity.startActivity(intent);
                    sp.edit().putBoolean(KEY_PROMPTED, true).apply();
                    Log.i(TAG, "Battery opt request launched");
                    return true;
                } catch (Exception e) {
                    Log.w(TAG, "direct request failed, open settings", e);
                    try {
                        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        activity.startActivity(intent);
                        sp.edit().putBoolean(KEY_PROMPTED, true).apply();
                        return true;
                    } catch (Exception e2) {
                        Log.w(TAG, "open settings failed", e2);
                        return false;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "requestIgnore failed", e);
        }
        return false;
    }
    public static void resetPromptedFlag(Context ctx) {
        try {
            ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit().remove(KEY_PROMPTED).apply();
        } catch (Exception e) {
            Log.w(TAG, "reset failed", e);
        }
    }
}
