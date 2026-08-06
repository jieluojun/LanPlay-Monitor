package org.kivy.android;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/**
 * 透明沉浸式状态栏 - 最终版 2026-08-06 v3
 * 本次强制透明：状态栏 + 导航栏 全透明，内容延伸到系统栏下方
 * 
 * 与原版差异对比（关键 4 行）：
 *   原：window.addFlags(FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
 *       window.addFlags(FLAG_TRANSLUCENT_STATUS);  // 半透明灰色，遮挡透明
 *   新：window.clearFlags(FLAG_TRANSLUCENT_STATUS);
 *       window.clearFlags(FLAG_TRANSLUCENT_NAVIGATION);
 *       window.addFlags(FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
 *       window.setStatusBarColor(Color.TRANSPARENT);
 *       window.setNavigationBarColor(Color.TRANSPARENT);
 */
public class ImmersiveStatusBarHelper {

    private static final String TAG = "ImmersiveStatusBar";
    private static boolean s_installed = false;
    private static volatile boolean s_isDarkPage = false;

    public static synchronized void install(final Activity activity) {
        if (activity == null || s_installed) {
            return;
        }
        try {
            final Window window = activity.getWindow();

            // === 1) 透明状态栏核心：清除半透明，设为全透明 ===
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // 必须先清除半透明，否则 setStatusBarColor 不生效
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                // 强制透明
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                // 国产 ROM 二次设置确保生效
                window.setNavigationBarColor(Color.TRANSPARENT);
                Log.i(TAG, "window colors set to TRANSPARENT");
            }

            // === 2) 内容延伸到状态栏/导航栏下方 ===
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false);
                // 图标颜色由 setPageTheme 决定，这里不强制
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                int cur = window.getDecorView().getSystemUiVisibility();
                window.getDecorView().setSystemUiVisibility(flags | (cur & (View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)));
            }

            dispatchSystemUiModeToFrontend(activity);
            s_installed = true;
            Log.i(TAG, "Transparent Immersive installed (API " + Build.VERSION.SDK_INT + ") - v3 transparent");
        } catch (Exception e) {
            Log.e(TAG, "install failed", e);
        }
    }

    public static void setPageTheme(final Activity activity, final boolean isDarkPage) {
        s_isDarkPage = isDarkPage;
        if (activity == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = activity.getWindow().getInsetsController();
                if (controller != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    int appearance = 0;
                    try { appearance = controller.getSystemBarsAppearance(); } catch (Exception ignored) {}
                    appearance &= ~mask;
                    if (!isDarkPage) {
                        appearance |= mask; // 浅色页面用黑色图标
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
            final int uiMode = activity.getResources().getConfiguration().uiMode
                    & Configuration.UI_MODE_NIGHT_MASK;
            final boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
            final String js = "try{localStorage.setItem('lanplay_system_dark',"
                    + (isSystemDark ? "'1'" : "'0'")
                    + ");window.__lanplaySystemDark=" + (isSystemDark ? "true" : "false")
                    + ";"
                    + "(window.applySystemDarkMode&&window.applySystemDarkMode("
                    + (isSystemDark ? "true" : "false") + "));"
                    + "}catch(e){}";
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (PythonActivity.mWebView != null) {
                            PythonActivity.mWebView.evaluateJavascript(js, null);
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "evaluateJavascript failed", e);
                    }
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "dispatchSystemUiModeToFrontend failed", e);
        }
    }

    public static void onSystemUiModeChanged(final Activity activity) {
        dispatchSystemUiModeToFrontend(activity);
    }

    public static boolean isDarkPage() {
        return s_isDarkPage;
    }
}
