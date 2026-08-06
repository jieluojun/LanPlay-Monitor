package org.kivy.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

/**
 * 主动请求"忽略电池优化"帮助类。
 *
 * 用法：
 *   BatteryOptimizationHelper.requestIgnoreBatteryOptimizationsIfNeeded(activity);
 *   // 1) 首次调用时，如果应用还未被加入电池优化白名单，
 *   //    会弹一个系统弹窗（仅一次），用户允许即可；
 *   // 2) 再次调用则直接跳过（避免打扰用户）。
 *
 * 注意事项：
 *   - Google Play 对 ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 有限制，但本应用不在 Play 上架，
 *     走的是 p4a 自打包 APK，因此使用该 API 是安全的。
 *   - 仅在 API 23+（Android 6.0）才支持电池优化，低于此版本直接返回。
 *   - 如果厂商 ROM 把这个 Intent 屏蔽了（例如部分 MIUI/ColorOS 旧版），
 *     会降级跳转到"应用信息"页面，让用户手动去关闭电池优化。
 */
public class BatteryOptimizationHelper {

    private static final String TAG = "BatteryOptHelper";
    private static final String PREFS_NAME = "lanplay_battery_opt";
    private static final String KEY_PROMPTED = "prompted_at_least_once";
    /** 同一进程最多允许调用几次弹窗，避免极端情况下反复触发 */
    private static final int MAX_LIFETIME_PROMPTS = 1;
    private static int s_lifetimePromptCount = 0;

    /**
     * 入口：若条件满足，则弹出系统"忽略电池优化"对话框。
     * @return true  表示本次触发了弹窗或跳转到设置；false 表示已经处理过/系统不支持。
     */
    public static boolean requestIgnoreBatteryOptimizationsIfNeeded(final Activity activity) {
        if (activity == null) {
            Log.w(TAG, "activity is null, skip");
            return false;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            Log.i(TAG, "Android < 6.0, no battery-optimization concept, skip");
            return false;
        }

        final Context ctx = activity.getApplicationContext();
        final PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm == null) {
            Log.w(TAG, "PowerManager is null, skip");
            return false;
        }
        if (pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
            Log.i(TAG, "App already in battery-optimization whitelist, skip");
            return false;
        }

        // 已询问过用户 → 不再重复打扰
        if (s_lifetimePromptCount >= MAX_LIFETIME_PROMPTS) {
            Log.i(TAG, "Already prompted once this process, skip");
            return false;
        }
        try {
            final android.content.SharedPreferences prefs =
                    ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (prefs.getBoolean(KEY_PROMPTED, false)) {
                Log.i(TAG, "Already prompted in a previous launch, skip");
                return false;
            }
            // 记录"已询问"，避免下次启动再弹
            prefs.edit().putBoolean(KEY_PROMPTED, true).apply();
        } catch (Exception e) {
            Log.w(TAG, "SharedPreferences failed, fallback to in-memory only", e);
        }
        s_lifetimePromptCount++;

        final boolean[] dispatched = { false };
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(
                                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                        // 部分国产 ROM 要求必须加 NEW_TASK 标记才能弹
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(intent);
                        dispatched[0] = true;
                        Log.i(TAG, "ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS dispatched");
                    } catch (ActivityNotFoundException e) {
                        Log.w(TAG, "OEM ROM blocks the intent, fallback to APP_INFO", e);
                        try {
                            Intent fallback = new Intent(
                                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            fallback.setData(Uri.parse("package:" + ctx.getPackageName()));
                            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            activity.startActivity(fallback);
                            dispatched[0] = true;
                        } catch (Exception e2) {
                            Log.e(TAG, "Fallback intent also failed", e2);
                            try {
                                Toast.makeText(activity,
                                        "请在系统设置中允许本应用忽略电池优化",
                                        Toast.LENGTH_LONG).show();
                            } catch (Exception ignored) {}
                        }
                    } catch (SecurityException se) {
                        // 没有 android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS 权限。
                        // 该权限是 normal 级，只要在 manifest 声明即自动授予，无需 requestPermissions。
                        // 报这个异常一般是 manifest 里漏了。
                        Log.e(TAG, "Missing REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission", se);
                    } catch (Exception e) {
                        Log.e(TAG, "Unexpected error when launching battery-opt intent", e);
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "runOnUiThread failed", e);
        }
        return dispatched[0];
    }

    /**
     * 强制重置 SharedPreferences 中的"已询问"标记，主要用于"手动重试"按钮。
     */
    public static void resetPromptedFlag(Context ctx) {
        if (ctx == null) return;
        try {
            ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().remove(KEY_PROMPTED).apply();
            s_lifetimePromptCount = 0;
        } catch (Exception e) {
            Log.w(TAG, "resetPromptedFlag failed", e);
        }
    }
}
