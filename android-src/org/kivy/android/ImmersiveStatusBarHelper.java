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
 * 沉浸式状态栏 / 边缘到边缘（Edge-to-Edge）助手 - 已修复版
 *
 * 修复说明（针对原版失效问题）：
 *  1. 原版同时执行了 addFlags(FLAG_TRANSLUCENT_STATUS) + FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS，
 *     这两个 flag 是互斥的。FLAG_TRANSLUCENT_STATUS 会让状态栏变成半透明灰色蒙层，
 *     并且阻止 setStatusBarColor(Color.TRANSPARENT) 生效，导致 WebView 无法真正延伸到
 *     状态栏下方，表现为“沉浸式没有效果”。
 *     修复：改为 clearFlags(FLAG_TRANSLUCENT_STATUS | FLAG_TRANSLUCENT_NAVIGATION)，
 *           只保留 FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS。
 *
 *  2. API 30+ 必须在 setDecorFitsSystemWindows(false) 之前先把窗口背景设为透明，
 *     否则导航条仍会出现白/黑底。
 *
 *  3. API 21-29 保留 SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | LAYOUT_HIDE_NAVIGATION
 *     并在 setPageTheme 中正确处理 LIGHT_STATUS_BAR 标志的叠加，避免 toggle 时丢失
 *     LAYOUT 标志。
 *
 *  对外 API 不变：install(activity) / setPageTheme(activity, isDarkPage)
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

            // 1) 彻底清除半透明标志，换成透明绘制模式
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // ★★★ 关键修复：原来是 addFlags(TRANSLUCENT_STATUS) 导致失效，改为 clear ★★★
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                // 许多国产 ROM 需要同时把背景设为透明才能让内容延伸
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setNavigationBarColor(Color.TRANSPARENT);
                }
            }

            // 2) 让内容延伸到系统栏下方
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // API 30+ 新 API
                window.setDecorFitsSystemWindows(false);
                // 默认先不强制指定图标颜色，交给 setPageTheme 决定
                // 但要保证 controller 存在时不崩
                try {
                    WindowInsetsController controller = window.getInsetsController();
                    if (controller != null) {
                        // 不在这里强行设置 appearance，等待前端主题推送
                    }
                } catch (Exception ignored) {}
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                // API 21-29 旧 flag —— 必须同时带上 LAYOUT_STABLE 避免闪动
                int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                // 保留当前已有的 LIGHT 标志位（如果已设置过）
                int cur = window.getDecorView().getSystemUiVisibility();
                // 清掉可能干扰的 FLAG_TRANSLUCENT 相关位已在上面处理
                window.getDecorView().setSystemUiVisibility(flags | (cur & (View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)));
            }

            // 3) 推送当前系统夜间模式给前端
            dispatchSystemUiModeToFrontend(activity);

            s_installed = true;
            Log.i(TAG, "Immersive status bar installed (API " + Build.VERSION.SDK_INT + ") - fixed");
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
                    // 取当前 appearance，再按需增/删 LIGHT 位
                    int appearance = 0;
                    try {
                        appearance = controller.getSystemBarsAppearance();
                    } catch (Exception ignored) {}
                    // 先清掉 mask 位
                    appearance &= ~mask;
                    if (!isDarkPage) {
                        // 浅色页面：图标用黑色
                        appearance |= mask;
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
                // 必须保留 LAYOUT 标志，避免切换主题时内容突然不延伸
                int layoutMask = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                // 确保 LAYOUT 标志常驻
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
