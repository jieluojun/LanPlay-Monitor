package org.kivy.android;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/**
 * 状态栏跟随网页颜色版 - 2026-08-06 v5
 * 浅色网页 -> 状态栏 #DFF3FF  + 黑色图标
 * 深色网页 -> 状态栏 #0F1923  + 白色图标
 * 导航栏同步跟随
 */
public class ImmersiveStatusBarHelper {
    private static final String TAG = "ImmersiveStatusBar";
    private static boolean s_installed = false;
    private static volatile boolean s_isDarkPage = false;

    // 与 script.js --bg 保持一致
    private static final int COLOR_LIGHT_BG = Color.parseColor("#DFF3FF");
    private static final int COLOR_DARK_BG  = Color.parseColor("#0F1923");

    public static synchronized void install(final Activity activity) {
        if (activity == null) return;
        applyFollowColor(activity, s_isDarkPage);
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() { applyFollowColor(activity, s_isDarkPage); }
        }, 500);
        s_installed = true;
        dispatchSystemUiModeToFrontend(activity);
        Log.i(TAG, "FollowColor install (API " + Build.VERSION.SDK_INT + ")");
    }

    // 根据 isDarkPage 同时设置 背景色 + 图标色 + 延伸
    private static void applyFollowColor(Activity activity, boolean isDarkPage) {
        try {
            Window window = activity.getWindow();
            int bg = isDarkPage ? COLOR_DARK_BG : COLOR_LIGHT_BG;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                // 跟随网页：状态栏/导航栏 设为网页同色（非透明）
                window.setStatusBarColor(bg);
                window.setNavigationBarColor(bg);
                // 仍允许内容延伸到栏下方，但由于颜色与网页一致，视觉上是“融合”
                // 如需完全不透明可去掉 FLAG_LAYOUT_NO_LIMITS
                // window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
            }

            // 延伸标志（保证切主题后不丢失）
            View decor = window.getDecorView();
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            int cur = decor.getSystemUiVisibility();
            int lightMask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) lightMask |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            decor.setSystemUiVisibility(flags | (cur & lightMask));

            // 图标颜色
            applyIconColor(activity, isDarkPage);

        } catch (Exception e) {
            Log.e(TAG, "applyFollowColor failed", e);
        }
    }

    private static void applyIconColor(Activity activity, boolean isDarkPage) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController c = activity.getWindow().getInsetsController();
                if (c != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                             | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    int appearance = 0;
                    try { appearance = c.getSystemBarsAppearance(); } catch (Exception ignored) {}
                    appearance &= ~mask;
                    if (!isDarkPage) appearance |= mask; // 浅色背景 -> 黑图标
                    c.setSystemBarsAppearance(appearance, mask);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = activity.getWindow().getDecorView();
                int flags = decor.getSystemUiVisibility();
                int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) mask |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                if (isDarkPage) flags &= ~mask;
                else flags |= mask;
                decor.setSystemUiVisibility(flags);
            }
        } catch (Exception e) { Log.w(TAG, "applyIconColor failed", e); }
    }

    public static void setPageTheme(final Activity activity, final boolean isDarkPage) {
        s_isDarkPage = isDarkPage;
        if (activity == null) return;
        applyFollowColor(activity, isDarkPage);
        Log.i(TAG, "Page theme applied: isDarkPage=" + isDarkPage + " bg=" + String.format("#%06X", (0xFFFFFF & (isDarkPage ? COLOR_DARK_BG : COLOR_LIGHT_BG))));
    }

    private static void dispatchSystemUiModeToFrontend(final Activity activity) {
        try {
            int uiMode = activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
            String js = "try{localStorage.setItem('lanplay_system_dark','" + (isSystemDark?"1":"0") + "');window.__lanplaySystemDark=" + (isSystemDark?"true":"false") + ";(window.applySystemDarkMode&&window.applySystemDarkMode(" + (isSystemDark?"true":"false") + "));}catch(e){}";
            activity.runOnUiThread(new Runnable() {
                @Override public void run() {
                    try { if (PythonActivity.mWebView != null) PythonActivity.mWebView.evaluateJavascript(js, null); } catch (Exception e) { Log.w(TAG, "evaluateJavascript failed", e); }
                }
            });
        } catch (Exception e) { Log.w(TAG, "dispatch failed", e); }
    }
    public static void onSystemUiModeChanged(final Activity activity) { dispatchSystemUiModeToFrontend(activity); }
    public static boolean isDarkPage() { return s_isDarkPage; }
}
