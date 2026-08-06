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
 * 透明状态栏最终版 v4 - 强制全透明 + 内容延伸
 * 解决构建后仍为不透明黑条的问题
 */
public class ImmersiveStatusBarHelper {
    private static final String TAG = "ImmersiveStatusBar";
    private static boolean s_installed = false;
    private static volatile boolean s_isDarkPage = false;

    public static synchronized void install(final Activity activity) {
        if (activity == null) return;
        // 允许重复调用以覆盖被系统重置的值
        applyTransparent(activity);
        // 延迟二次应用，应对 p4a 后续的 setContentView 覆盖
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() { applyTransparent(activity); }
        }, 500);
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() { applyTransparent(activity); }
        }, 1500);
        s_installed = true;
        dispatchSystemUiModeToFrontend(activity);
        Log.i(TAG, "Transparent install requested (API " + Build.VERSION.SDK_INT + ")");
    }

    private static void applyTransparent(Activity activity) {
        try {
            final Window window = activity.getWindow();
            // 1) 清除所有半透明/透标记
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                // 关键：状态栏 + 导航栏 全透明
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                // 允许内容布局到系统栏下方（兼容旧版）
                window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
                // 某些 ROM 需要
                window.setNavigationBarColor(Color.TRANSPARENT);
            }
            // 2) 内容延伸
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
                // 确保不被旧 flag 干扰
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        // 默认不强制，交给 setPageTheme
                    }
                }
            }
            // 3) 旧版 layout 标志（所有版本都设，兼容）
            View decor = window.getDecorView();
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            // 保留已有的 LIGHT 标志
            int cur = decor.getSystemUiVisibility();
            int lightMask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                lightMask |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            decor.setSystemUiVisibility(flags | (cur & lightMask));
            Log.i(TAG, "applyTransparent executed, decor flags=" + decor.getSystemUiVisibility());
        } catch (Exception e) {
            Log.e(TAG, "applyTransparent failed", e);
        }
    }

    public static void setPageTheme(final Activity activity, final boolean isDarkPage) {
        s_isDarkPage = isDarkPage;
        if (activity == null) return;
        try {
            // 每次切主题都先确保透明未被重置
            applyTransparent(activity);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = activity.getWindow().getInsetsController();
                if (controller != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    int appearance = 0;
                    try { appearance = controller.getSystemBarsAppearance(); } catch (Exception ignored) {}
                    appearance &= ~mask;
                    if (!isDarkPage) {
                        appearance |= mask; // 浅色页面 -> 深色图标
                    }
                    controller.setSystemBarsAppearance(appearance, mask);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = activity.getWindow().getDecorView();
                int flags = decor.getSystemUiVisibility();
                int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mask |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                int layoutMask = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                flags |= layoutMask;
                if (isDarkPage) {
                    flags &= ~mask;
                } else {
                    flags |= mask;
                }
                decor.setSystemUiVisibility(flags);
            }
            Log.i(TAG, "Page theme applied: isDarkPage=" + isDarkPage);
        } catch (Exception e) {
            Log.w(TAG, "setPageTheme failed", e);
        }
    }

    private static void dispatchSystemUiModeToFrontend(final Activity activity) {
        try {
            final int uiMode = activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            final boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
            final String js = "try{localStorage.setItem('lanplay_system_dark','" + (isSystemDark?"1":"0") + "');window.__lanplaySystemDark=" + (isSystemDark?"true":"false") + ";(window.applySystemDarkMode&&window.applySystemDarkMode(" + (isSystemDark?"true":"false") + "));}catch(e){}";
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
