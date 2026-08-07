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
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/**
 * 状态栏跟随网页颜色版 - 2026-08-07 v7 FIXED
 *
 * v7 修复：启动图（_load.html / presplash 加载页）状态栏没有隐藏。
 *  根因：install() 一上来就 applyFollowColorInternal() 把状态栏"显示"出来，
 *        而此时仍停留在启动加载页（该页不会回调 syncPageTheme），状态栏就一直压在启动图上。
 *  修复：
 *  1. install() 改为先进入"启动沉浸式"：状态栏+导航栏完全隐藏（刘海/下巴区域由启动图铺满）。
 *  2. 只有当前端真实页面加载完成后通过 LanPlayNative.syncPageTheme(isDark) 回调时，
 *     才重新显示"跟随页面颜色"的状态栏（浅色页 #DFF3FF / 深色页 #0F1923）。
 *  3. R+ 用 WindowInsetsController.show()/hide()；R 以下用 setSystemUiVisibility 切换 FULLSCREEN/HIDE 标志。
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
        // 首次在主线程应用：启动加载页期间保持状态栏/导航栏完全隐藏
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                synchronized (s_lock) {
                    applySplashImmersiveInternal(activity);
                }
            }
        });
        // 延迟 500ms 再应用一次，抵御 p4a webview 启动时 Window 被二次重置
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                synchronized (s_lock) {
                    if (activity.isFinishing() || activity.isDestroyed()) return;
                    applySplashImmersiveInternal(activity);
                }
            }
        }, 500);
        dispatchSystemUiModeToFrontend(activity);
        Log.i(TAG, "SplashImmersive install v7 (API " + Build.VERSION.SDK_INT + ") status bar HIDDEN until page loads");
    }

    // 启动沉浸式：状态栏+导航栏完全隐藏，启动图铺满全屏（刘海/下巴也盖住）
    private static void applySplashImmersiveInternal(Activity activity) {
        try {
            Window window = activity.getWindow();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
                WindowInsetsController c = window.getInsetsController();
                if (c != null) {
                    c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
                // 确保导航栏对比度强制关闭，避免系统自动给导航栏加遮罩
                try { window.setNavigationBarContrastEnforced(false); } catch (Exception ignored) {}
            } else {
                View decor = window.getDecorView();
                decor.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                      | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                      | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                      | View.SYSTEM_UI_FLAG_FULLSCREEN
                      | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                      | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            Log.i(TAG, "applySplashImmersive: bars hidden");
        } catch (Exception e) {
            Log.e(TAG, "applySplashImmersiveInternal failed", e);
        }
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
                // R+ 推荐方式：重新显示被启动阶段隐藏的状态栏/导航栏
                window.setDecorFitsSystemWindows(false);
                WindowInsetsController c = window.getInsetsController();
                if (c != null) {
                    c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
                }
                // 确保导航栏对比度强制关闭，避免系统自动给导航栏加遮罩
                try { window.setNavigationBarContrastEnforced(false); } catch (Exception ignored) {}
            } else {
                // R 以下：传统 flags。此处不含 FULLSCREEN/HIDE/IMMERSIVE，
                // setSystemUiVisibility 整体覆盖后会重新显示被隐藏的状态栏/导航栏
                View decor = window.getDecorView();
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
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
                // 基础延伸标志（不含隐藏标志，覆盖后会显示状态栏）
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
     * JS 主动调用：同步页面主题到状态栏。
     * 前端真实页面加载完成后调用本方法 -> 状态栏从"启动隐藏"切换到"跟随页面颜色"。
     * 必须在任意线程可调用，内部自动切到主线程。
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
