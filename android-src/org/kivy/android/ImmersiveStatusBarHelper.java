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
 * 沉浸式状态栏 / 边缘到边缘（Edge-to-Edge）助手。
 *
 * 实现要点（适配 API 21 ~ 34+）：
 *  1. 把状态栏和导航栏的窗口背景设为透明（FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS + Color.TRANSPARENT）。
 *  2. 让 WebView 延伸到状态栏区域下方（FLAG_LAYOUT_NO_LIMITS / setDecorFitsSystemWindows(false)）。
 *  3. 主动把状态栏图标颜色切到「亮色 / 暗色」：
 *     - 页面是浅色背景（isDarkPage=false）→ 状态栏图标用「暗色」（黑），保证可读；
 *     - 页面是深色背景（isDarkPage=true）  → 状态栏图标用「亮色」（白）。
 *  4. 通过 dispatchSystemUiModeToFrontend 监听 Configuration.uiMode（夜间模式），
 *     主动推送给前端 JS（前端再用 matchMedia 兜底，保证双保险）。
 *
 * 该类对外只暴露两个静态方法：install(activity) / setPageTheme(activity, isDarkPage)。
 * FileChooserHelper.install() 内部会调用本类。
 */
public class ImmersiveStatusBarHelper {

    private static final String TAG = "ImmersiveStatusBar";
    private static boolean s_installed = false;

    /** 缓存当前是否是「深色页面」，用于在 onConfigurationChanged 重新应用图标色 */
    private static volatile boolean s_isDarkPage = false;

    /**
     * 入口：在 Activity.onCreate 之后调用一次。
     * 实现"透明状态栏 + 内容延伸到状态栏下方"的效果。
     */
    public static synchronized void install(final Activity activity) {
        if (activity == null || s_installed) {
            return;
        }
        try {
            final Window window = activity.getWindow();
            // 1) 允许窗口绘制到状态栏 / 导航栏区域
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                // 不再设置 FLAG_TRANSLUCENT_NAVIGATION，避免与下面的 setNavigationBarColor 冲突
                window.setStatusBarColor(Color.TRANSPARENT);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setNavigationBarColor(Color.TRANSPARENT);
                }
            }

            // 2) 让 DecorView 的内容延伸到状态栏下方
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // API 30+：新 API
                window.setDecorFitsSystemWindows(false);
                window.getInsetsController().setSystemBarsAppearance(
                        0,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // API 21-29：用旧 flag
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                window.getDecorView().setSystemUiVisibility(flags);
            }

            // 3) 监听系统 UI Mode 变化（白天/夜间），推送给前端
            dispatchSystemUiModeToFrontend(activity);

            s_installed = true;
            Log.i(TAG, "Immersive status bar installed (API " + Build.VERSION.SDK_INT + ")");
        } catch (Exception e) {
            Log.e(TAG, "install failed", e);
        }
    }

    /**
     * 由前端 JS 调用，告诉 Java 当前页面是浅色还是深色，
     * 用于把状态栏 / 导航栏的图标切到合适的颜色以保证可读性。
     *
     * JS 调用方式（通过 FileChooserHelper.syncPageTheme）：
     *   FileChooserHelper.syncPageTheme(true);   // 告诉 Java 当前是深色页面
     */
    public static void setPageTheme(final Activity activity, final boolean isDarkPage) {
        s_isDarkPage = isDarkPage;
        if (activity == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = activity.getWindow().getInsetsController();
                if (controller != null) {
                    int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                            | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    int appearance = controller.getSystemBarsAppearance() & ~mask;
                    if (!isDarkPage) {
                        // 浅色页面：状态栏图标用「暗色」（黑色）
                        appearance |= mask;
                    }
                    controller.setSystemBarsAppearance(appearance, mask);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int flags = activity.getWindow().getDecorView().getSystemUiVisibility();
                int mask = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mask |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                if (isDarkPage) {
                    flags &= ~mask;
                } else {
                    flags |= mask;
                }
                activity.getWindow().getDecorView().setSystemUiVisibility(flags);
            }
            Log.i(TAG, "Page theme applied: isDarkPage=" + isDarkPage);
        } catch (Exception e) {
            Log.w(TAG, "setPageTheme failed", e);
        }
    }

    /**
     * 读取当前系统 UI Mode（夜间模式），写入到 WebView 的 localStorage / 一次性 cookie 中，
     * 前端 JS 在启动时读这个 key 决定初始主题；之后前端用 matchMedia('(prefers-color-scheme: dark)')
     * 继续监听系统变化（双保险）。
     */
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

    /**
     * 暴露给前端的 Activity 回调：当用户切换系统主题时，
     * 重新推送一次"是否深色"给前端。
     */
    public static void onSystemUiModeChanged(final Activity activity) {
        dispatchSystemUiModeToFrontend(activity);
    }

    public static boolean isDarkPage() {
        return s_isDarkPage;
    }
}
