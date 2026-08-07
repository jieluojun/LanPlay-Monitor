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
 * 状态栏跟随网页颜色版 - 2026-08-07 v6 FIXED
 * 修复：
 *  1. setPageTheme 强制在主线程执行，避免 JS 桥接线程直接操作 Window 失效
 *  2. 去除 FLAG_LAYOUT_NO_LIMITS，用 decorFitsSystemWindows(false) 实现沉浸式，状态栏颜色才可实时刷新
 *  3. applyFollowColor 中先清旧的 lightMask 标记再重新应用，避免旧图标逻辑残留
 *  4. 增加 post 延迟二次应用，确保 WebView 重绘后状态栏不回弹为透明
 *  5. 日志增加更详细 isDarkPage 变化，便于 /api/logs 排查
 *
 * 浅色网页 -> 状态栏 #DFF3FF  + 黑色图标
 * 深色网页 -> 状态栏 #0F1923  + 白色图标
 * 导航栏同步跟随
 */
public class ImmersiveStatusBarHelper {
    private static final String TAG = "ImmersiveStatusBar";
    private static volatile boolean s_isDarkPage = false;
    private static final Object s_lock = new Object();

    // 与 script.js --bg 保持一致
    private static final int COLOR_LIGHT_BG = Color.parseColor("#DFF3FF");
    private static final int COLOR_DARK_BG  = Color.parseColor("#0F1923");

    public static void install(final Activity activity) {
        if (activity == null) return;
        // 首次在主线程应用
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                synchronized (s_lock) {
                    applyFollowColorInternal(activity, s_isDarkPage);
                }
            }
        });
        // 延迟 500ms 再应用一次，抵御 p4a webview 启动时 Window 被二次重置
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                synchronized (s_lock) {
                    if (activity.isFinishing() || activity.isDestroyed()) return;
                    applyFollowColorInternal(activity, s_isDarkPage);
                }
            }
        }, 500);
        dispatchSystemUiModeToFrontend(activity);
        Log.i(TAG, "FollowColor install v6 (API " + Build.VERSION.SDK_INT + ") isDarkPage=" + s_isDarkPage);
    }

    // 内部实现，调用方必须已在主线程且持有 s_lock（或通过 runOnUiThread 间接保证）
    private static void applyFollowColorInternal(Activity activity, boolean isDarkPage) {
        try {
            Window window = activity.getWindow();
            int bg = isDarkPage ? COLOR_DARK_BG : COLOR_LIGHT_BG;

            // 1. 清理旧的半透明标记
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.setStatusBarColor(bg);
                window.setNavigationBarColor(bg);
            }

            // 2. 沉浸式：内容延伸到状态栏下方，但保持状态栏颜色不透明
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // R+ 推荐方式
                window.setDecorFitsSystemWindows(false);
                // 确保导航栏对比度强制关闭，避免系统自动给导航栏加遮罩
                try {
                    window.setNavigationBarContrastEnforced(false);
                } catch (Exception ignored) {}
            } else {
                // R 以下：传统 flags
                View decor = window.getDecorView();
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                // 保留当前已有的 LIGHT 标记，图标颜色由 applyIconColor 决定
                decor.setSystemUiVisibility(flags);
            }

            // 3. 图标颜色（必须在背景色之后）
            applyIconColorInternal(activity, isDarkPage);

            Log.i(TAG, "applyFollowColor bg=" + String.format("#%06X", (0xFFFFFF & bg)) + " isDarkPage=" + isDarkPage);

        } catch (Exception e) {
            Log.e(TAG, "applyFollowColorInternal failed", e);
        }
    }

    private static void applyIconColorInternal(Activity activity, boolean isDarkPage) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController c = activity.getWindow().getInsetsController();
                if (c != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                             | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    int appearance = 0;
                    try { appearance = c.getSystemBarsAppearance(); } catch (Exception ignored) {}
                    // 先清掉旧的 light 标记
                    appearance &= ~mask;
                    if (!isDarkPage) {
                        // 浅色背景 -> 需要深色（黑色）图标
                        appearance |= mask;
                    }
                    c.setSystemBarsAppearance(appearance, mask);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = activity.getWindow().getDecorView();
                // 基础延伸标志
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                // 根据页面深浅决定是否加 LIGHT_ 标志
                if (!isDarkPage) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                }
                decor.setSystemUiVisibility(flags);
            }
        } catch (Exception e) {
            Log.w(TAG, "applyIconColorInternal failed", e);
        }
    }

    /**
     * JS 主动调用：同步页面主题到状态栏
     * 必须在任意线程可调用，内部自动切到主线程
     */
    public static void setPageTheme(final Activity activity, final boolean isDarkPage) {
        synchronized (s_lock) {
            s_isDarkPage = isDarkPage;
        }
        if (activity == null) {
            Log.w(TAG, "setPageTheme activity null, cached isDarkPage=" + isDarkPage);
            return;
        }
        // 确保在主线程执行
        if (Looper.myLooper() == Looper.getMainLooper()) {
            synchronized (s_lock) {
                applyFollowColorInternal(activity, isDarkPage);
            }
            Log.i(TAG, "Page theme applied [same-thread]: isDarkPage=" + isDarkPage + " bg=" + String.format("#%06X", (0xFFFFFF & (isDarkPage ? COLOR_DARK_BG : COLOR_LIGHT_BG))));
        } else {
            activity.runOnUiThread(new Runnable() {
                @Override public void run() {
                    synchronized (s_lock) {
                        if (activity.isFinishing() || activity.isDestroyed()) return;
                        applyFollowColorInternal(activity, s_isDarkPage);
                    }
                    Log.i(TAG, "Page theme applied [ui-thread]: isDarkPage=" + s_isDarkPage + " bg=" + String.format("#%06X", (0xFFFFFF & (s_isDarkPage ? COLOR_DARK_BG : COLOR_LIGHT_BG))));
                }
            });
        }
    }

    private static void dispatchSystemUiModeToFrontend(final Activity activity) {
        try {
            int uiMode = activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
            final String js = "(function(){try{"
                    + "localStorage.setItem('lanplay_system_dark','" + (isSystemDark?"1":"0") + "');"
                    + "window.__lanplaySystemDark=" + (isSystemDark?"true":"false") + ";"
                    + "if(window.applySystemDarkMode) window.applySystemDarkMode(" + (isSystemDark?"true":"false") + ");"
                    + "}catch(e){}})();";
            activity.runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        if (PythonActivity.mWebView != null) {
                            PythonActivity.mWebView.evaluateJavascript(js, null);
                        }
                    } catch (Exception e) { Log.w(TAG, "evaluateJavascript failed", e); }
                }
            });
        } catch (Exception e) { Log.w(TAG, "dispatch failed", e); }
    }

    public static void onSystemUiModeChanged(final Activity activity) {
        // 系统深浅变化只通知前端，不直接改状态栏颜色
        // 状态栏颜色始终跟随网页主题（由 JS 决定是否跟随系统）
        dispatchSystemUiModeToFrontend(activity);
    }

    public static boolean isDarkPage() { return s_isDarkPage; }
}
