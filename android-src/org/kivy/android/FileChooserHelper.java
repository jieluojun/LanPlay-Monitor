package org.kivy.android;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * 为 p4a webview bootstrap 的 WebView 安装 WebChromeClient：
 *   1. <input type="file">：用 Intent.createChooser 唤起系统相册/视频/文件选择器
 *   2. getUserMedia 麦克风：自动批准 WebView 麦克风请求，并向 Android 系统申请 RECORD_AUDIO 权限
 *   3. 沉浸式状态栏 + 边缘到边缘（透明状态栏、内容延伸到状态栏下方）
 *   4. 主动请求"忽略电池优化"（启动时一次性弹窗）
 *   5. 监听系统主题（白天/夜间），把结果注入到前端 JS
 *   6. JS 可调 Java：`FileChooserHelper.syncPageTheme(true|false)` 同步页面主题，
 *      决定状态栏图标是「亮色 / 暗色」
 */
public class FileChooserHelper {

    private static final String TAG = "FileChooserHelper";
    private static final int FILECHOOSER_RESULTCODE = 5173;
    private static final int PERMISSION_REQ_RECORD_AUDIO = 5174;
    /** 与前端约定的命名空间：window.LanPlayNative.xxx */
    public static final String JS_NAMESPACE = "LanPlayNative";

    private static ValueCallback<Uri[]> mUploadMessage = null;
    private static boolean mInstalled = false;

    // HTML5 视频全屏回调状态
    private static View mCustomView = null;
    private static WebChromeClient.CustomViewCallback mCustomViewCallback = null;
    private static int mOriginalSystemUiVisibility = 0;

    public static boolean install() {
        final PythonActivity activity = PythonActivity.mActivity;
        final WebView webView = PythonActivity.mWebView;
        if (activity == null || webView == null) {
            Log.w(TAG, "activity or webView is null, cannot install FileChooserHelper");
            return false;
        }
        if (mInstalled) {
            Log.i(TAG, "FileChooserHelper already installed");
            return true;
        }
        mInstalled = true;

        // ---- 1. 沉浸式状态栏（透明状态栏 + 内容延伸到状态栏下方） ----
        try {
            ImmersiveStatusBarHelper.install(activity);
        } catch (Exception e) {
            Log.w(TAG, "ImmersiveStatusBarHelper.install failed", e);
        }

        // ---- 2. WebView 设置：缩放 + 文件选择 + 麦克风 ----
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebSettings settings = webView.getSettings();
                    // 除了图片查看器在 JS 层支持手势放大外，全局禁用 WebView 网页缩放
                    settings.setSupportZoom(false);
                    settings.setBuiltInZoomControls(false);
                    settings.setDisplayZoomControls(false);
                    settings.setUseWideViewPort(true);
                    settings.setLoadWithOverviewMode(true);
                    // 锁死 WebView 文本缩放为 100%，避免系统大字号撑破布局
                    settings.setTextZoom(100);
                    // 允许 WebView 内容占满设备宽度，不使用初始 scale=50%（那会让本地页面布局错乱）
                    webView.setInitialScale(0);
                    // 禁止 WebView 横向/纵向出现额外滚动条弹性（让前端 body overflow-x:hidden 接管）
                    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                    webView.setHorizontalScrollBarEnabled(false);
                    webView.setVerticalScrollBarEnabled(false);

                    // 让 WebView 的 prefers-color-scheme 跟随系统（API 21+ 实际上已经跟随；
                    // 但显式声明更清晰，也方便未来在 Android 11 以下做更细的控制）。
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        try {
                            // "light" / "dark" / 不设置（跟随系统）。这里不显式设置 → 跟随系统。
                            // Android 11+ WebView 已原生支持 prefers-color-scheme，无需额外配置。
                        } catch (Exception ignored) {}
                    }

                    webView.setWebChromeClient(new WebChromeClient() {

                        // ---------- 0. HTML5 视频全屏 ----------
                        @Override
                        public void onShowCustomView(View view, CustomViewCallback callback) {
                            Log.i(TAG, "onShowCustomView: entering fullscreen");
                            if (mCustomView != null) {
                                try { callback.onCustomViewHidden(); } catch (Exception ignored) {}
                                return;
                            }
                            mCustomView = view;
                            mCustomViewCallback = callback;
                            Window window = activity.getWindow();
                            mOriginalSystemUiVisibility = window.getDecorView().getSystemUiVisibility();
                            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
                            int flags = View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
                            if (Build.VERSION.SDK_INT >= 19) {
                                flags |= View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
                            }
                            window.getDecorView().setSystemUiVisibility(flags);
                            activity.addContentView(view, new ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT));
                        }

                        @Override
                        public void onHideCustomView() {
                            Log.i(TAG, "onHideCustomView: leaving fullscreen");
                            if (mCustomView != null) {
                                ViewGroup parent = (ViewGroup) mCustomView.getParent();
                                if (parent != null) parent.removeView(mCustomView);
                                mCustomView = null;
                            }
                            Window window = activity.getWindow();
                            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                            window.getDecorView().setSystemUiVisibility(mOriginalSystemUiVisibility);
                            if (mCustomViewCallback != null) {
                                try { mCustomViewCallback.onCustomViewHidden(); } catch (Exception ignored) {}
                                mCustomViewCallback = null;
                            }
                            // FIX: 退出全屏后重新应用沉浸式状态栏，避免颜色被重置为透明/黑色
                            try {
                                ImmersiveStatusBarHelper.install(activity);
                                // 再根据当前缓存的主题同步一次
                                ImmersiveStatusBarHelper.setPageTheme(activity, ImmersiveStatusBarHelper.isDarkPage());
                            } catch (Exception e) {
                                Log.w(TAG, "re-apply Immersive after fullscreen failed", e);
                            }
                        }

                        // ---------- 1. 文件选择（相册/视频/音频/文件） ----------
                        @Override
                        public boolean onShowFileChooser(WebView view,
                                ValueCallback<Uri[]> filePathCallback,
                                WebChromeClient.FileChooserParams params) {
                            Log.i(TAG, "onShowFileChooser called!");
                            if (mUploadMessage != null) {
                                mUploadMessage.onReceiveValue(null);
                                mUploadMessage = null;
                            }
                            mUploadMessage = filePathCallback;

                            Intent contentIntent = null;
                            try {
                                contentIntent = params.createIntent();
                                if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                                    contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                                }
                            } catch (Exception e) {
                                Log.w(TAG, "params.createIntent() failed, fallback to ACTION_GET_CONTENT", e);
                                contentIntent = null;
                            }

                            if (contentIntent == null) {
                                contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                                contentIntent.setType("*/*");
                                String[] acceptTypes = params.getAcceptTypes();
                                if (acceptTypes != null && acceptTypes.length > 0 && !acceptTypes[0].isEmpty()) {
                                    contentIntent.putExtra(Intent.EXTRA_MIME_TYPES, acceptTypes);
                                } else {
                                    contentIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
                                }
                                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                            }

                            Intent chooserIntent = Intent.createChooser(contentIntent, "选择文件或媒体");
                            try {
                                activity.startActivityForResult(chooserIntent, FILECHOOSER_RESULTCODE);
                                Log.i(TAG, "startActivityForResult dispatched successfully");
                            } catch (ActivityNotFoundException e) {
                                Log.e(TAG, "没有找到可用的文件选择器", e);
                                if (mUploadMessage != null) {
                                    mUploadMessage.onReceiveValue(null);
                                    mUploadMessage = null;
                                }
                                return false;
                            }
                            return true;
                        }

                        // ---------- 2. getUserMedia 麦克风（录音） ----------
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            Log.i(TAG, "onPermissionRequest called for: " + java.util.Arrays.toString(request.getResources()));
                            activity.runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        String[] requested = request.getResources();
                                        java.util.ArrayList<String> allow = new java.util.ArrayList<>();
                                        for (String r : requested) {
                                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)
                                                    || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                                allow.add(r);
                                            }
                                        }
                                        if (!allow.isEmpty()) {
                                            request.grant(allow.toArray(new String[0]));
                                            Log.i(TAG, "WebView permissions granted: " + allow);
                                        } else {
                                            request.deny();
                                        }
                                    } catch (Exception e) {
                                        Log.e(TAG, "onPermissionRequest grant error", e);
                                        try { request.deny(); } catch (Exception ignored) {}
                                    }
                                }
                            });
                        }

                        @Override
                        public boolean onConsoleMessage(android.webkit.ConsoleMessage msg) {
                            Log.i("WebViewConsole", msg.message() + " @" + msg.sourceId() + ":" + msg.lineNumber());
                            return false;
                        }
                    });

                    // 注册 Activity 结果监听器
                    activity.registerActivityResultListener(
                            new PythonActivity.ActivityResultListener() {
                                @Override
                                public void onActivityResult(int requestCode, int resultCode, Intent data) {
                                    if (requestCode != FILECHOOSER_RESULTCODE || mUploadMessage == null) {
                                        return;
                                    }
                                    Uri[] results = null;
                                    if (resultCode == Activity.RESULT_OK && data != null) {
                                        ClipData clip = data.getClipData();
                                        if (clip != null && clip.getItemCount() > 0) {
                                            int n = clip.getItemCount();
                                            results = new Uri[n];
                                            for (int i = 0; i < n; i++) {
                                                results[i] = clip.getItemAt(i).getUri();
                                            }
                                        } else if (data.getData() != null) {
                                            results = new Uri[]{data.getData()};
                                        } else if (data.getDataString() != null) {
                                            results = new Uri[]{Uri.parse(data.getDataString())};
                                        }
                                    }
                                    mUploadMessage.onReceiveValue(results);
                                    mUploadMessage = null;
                                    Log.i(TAG, "ActivityResult handled, results count: " + (results != null ? results.length : 0));
                                }
                            });

                    // 动态向 Android 系统申请麦克风权限
                    if (Build.VERSION.SDK_INT >= 23) {
                        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                                != PackageManager.PERMISSION_GRANTED) {
                            Log.i(TAG, "Requesting system RECORD_AUDIO permission...");
                            activity.requestPermissions(
                                    new String[]{Manifest.permission.RECORD_AUDIO},
                                    PERMISSION_REQ_RECORD_AUDIO);
                        } else {
                            Log.i(TAG, "RECORD_AUDIO permission already granted");
                        }
                    }

                    // ---- 3. 主动请求"忽略电池优化"（启动时一次性） ----
                    try {
                        BatteryOptimizationHelper.requestIgnoreBatteryOptimizationsIfNeeded(activity);
                    } catch (Exception e) {
                        Log.w(TAG, "BatteryOptimizationHelper request failed", e);
                    }

                    // ---- 4. 注册 Configuration 变化监听 → 通知前端主题变化 ----
                    try {
                        registerUiModeListener(activity);
                    } catch (Exception e) {
                        Log.w(TAG, "registerUiModeListener failed", e);
                    }

                    // ---- 5. 注入 window.LanPlayNative 桥接（让 JS 能调 Java） ----
                    try {
                        injectNativeBridge(webView);
                    } catch (Exception e) {
                        Log.w(TAG, "injectNativeBridge failed", e);
                    }

                    // ---- 6. 把初始系统主题（白天/夜间）推给前端 - 已修复：延迟重试并调用 applySystemDarkMode ----
                    try {
                        final int uiMode = activity.getResources().getConfiguration().uiMode
                                & Configuration.UI_MODE_NIGHT_MASK;
                        final boolean _isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
                        webView.post(new Runnable() {
                            int retries = 0;
                            @Override public void run() {
                                try {
                                    String js = "(function(){try{"
                                            + "localStorage.setItem('lanplay_system_dark','" + (_isSystemDark?"1":"0") + "');"
                                            + "window.__lanplaySystemDark=" + (_isSystemDark?"true":"false") + ";"
                                            + "if(window.applySystemDarkMode) window.applySystemDarkMode(" + (_isSystemDark?"true":"false") + ");"
                                            + "}catch(e){}})();";
                                    webView.evaluateJavascript(js, null);
                                    if (retries++ < 3) webView.postDelayed(this, 500);
                                } catch (Exception e) { Log.w(TAG, "init theme push failed", e); }
                            }
                        });
                    } catch (Exception e) {
                        Log.w(TAG, "init theme push failed", e);
                    }

                    Log.i(TAG, "✅ FileChooserHelper WebChromeClient installed successfully!");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to install WebChromeClient in runOnUiThread", e);
                }
            }
        });
        return true;
    }

    /**
     * 监听系统主题切换：使用 Application.ActivityLifecycleCallbacks 不行（要拿单 Activity），
     * 这里用反射在 Activity 上注册一个 ComponentCallbacks2 + ContentObserver 兜底；
     * 实际上更稳的做法是 PythonActivity.onConfigurationChanged() 主动调用本类的
     * ImmersiveStatusBarHelper.onSystemUiModeChanged(activity)。
     */
    private static void registerUiModeListener(final Activity activity) {
        try {
            activity.getApplication().registerComponentCallbacks(
                    new android.content.ComponentCallbacks2() {
                        @Override
                        public void onConfigurationChanged(android.content.res.Configuration newConfig) {
                            try {
                                int uiMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
                                boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
                                // 已移除直接 setPageTheme，改为只通知 JS，由 JS 根据是否跟随再决定是否同步状态栏
                                final String js = "(function(isDark){"
                                        + "try{window.__lanplaySystemDark=isDark;"
                                        + "localStorage.setItem('lanplay_system_dark',isDark?'1':'0');"
                                        + "if(window.applySystemDarkMode)window.applySystemDarkMode(isDark);"
                                        + "}catch(e){}"
                                        + "})(" + (isSystemDark ? "true" : "false") + ");";
                                activity.runOnUiThread(new Runnable() {
                                    @Override
                                    public void run() {
                                        try {
                                            if (PythonActivity.mWebView != null) {
                                                PythonActivity.mWebView.evaluateJavascript(js, null);
                                            }
                                        } catch (Exception ignored) {}
                                    }
                                });
                            } catch (Exception e) {
                                Log.w(TAG, "onConfigurationChanged dispatch failed", e);
                            }
                        }
                        @Override public void onLowMemory() {}
                        @Override public void onTrimMemory(int level) {}
                    });
        } catch (Exception e) {
            Log.w(TAG, "registerComponentCallbacks failed", e);
        }
    }

    /**
     * 注入 window.LanPlayNative，让前端 JS 可以主动调 Java：
     *   window.LanPlayNative.syncPageTheme(true);     // 告诉 Java 当前是深色页面
     *   window.LanPlayNative.requestBatteryOpt();     // 手动触发一次"忽略电池优化"请求
     *   window.LanPlayNative.getSystemDarkMode(callback);
     *   window.LanPlayNative.getInfo();                // 返回 {apiLevel, isDarkPage, ...}
     *
     * 实现：使用 addJavascriptInterface 暴露一个轻量包装类。
     */
    private static void injectNativeBridge(final WebView webView) {
        try {
            webView.addJavascriptInterface(new LanPlayNativeBridge(),
                    JS_NAMESPACE);
            Log.i(TAG, "Native bridge injected: window." + JS_NAMESPACE);
        } catch (Exception e) {
            Log.e(TAG, "addJavascriptInterface failed", e);
        }
    }

    /**
     * JS 主动调用的入口（@JavascriptInterface 必须，否则 4.2 以下会失效）。
     */
    public static class LanPlayNativeBridge {
        @android.webkit.JavascriptInterface
        public void syncPageTheme(final boolean isDarkPage) {
            try {
                final Activity activity = PythonActivity.mActivity;
                if (activity == null) return;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        ImmersiveStatusBarHelper.setPageTheme(activity, isDarkPage);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "syncPageTheme failed", e);
            }
        }

        @android.webkit.JavascriptInterface
        public void requestBatteryOpt() {
            try {
                final Activity activity = PythonActivity.mActivity;
                if (activity == null) return;
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        // 用户主动重试：清掉"已询问"标记，再弹一次
                        BatteryOptimizationHelper.resetPromptedFlag(activity);
                        BatteryOptimizationHelper.requestIgnoreBatteryOptimizationsIfNeeded(activity);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "requestBatteryOpt failed", e);
            }
        }

        @android.webkit.JavascriptInterface
        public boolean isIgnoringBatteryOptimizations() {
            try {
                final Activity activity = PythonActivity.mActivity;
                if (activity == null) return false;
                android.os.PowerManager pm = (android.os.PowerManager) activity
                        .getSystemService(Activity.POWER_SERVICE);
                if (pm == null) return false;
                return pm.isIgnoringBatteryOptimizations(activity.getPackageName());
            } catch (Exception e) {
                Log.w(TAG, "isIgnoringBatteryOptimizations failed", e);
                return false;
            }
        }

        @android.webkit.JavascriptInterface
        public String getInfo() {
            try {
                final Activity activity = PythonActivity.mActivity;
                if (activity == null) return "{}";
                android.os.PowerManager pm = (android.os.PowerManager) activity
                        .getSystemService(Activity.POWER_SERVICE);
                boolean inWhitelist = pm != null
                        && pm.isIgnoringBatteryOptimizations(activity.getPackageName());
                int uiMode = activity.getResources().getConfiguration().uiMode
                        & Configuration.UI_MODE_NIGHT_MASK;
                boolean isSystemDark = (uiMode == Configuration.UI_MODE_NIGHT_YES);
                return "{"
                        + "\"apiLevel\":" + Build.VERSION.SDK_INT
                        + ",\"isIgnoringBatteryOptimizations\":" + inWhitelist
                        + ",\"isSystemDark\":" + isSystemDark
                        + ",\"isDarkPage\":" + ImmersiveStatusBarHelper.isDarkPage()
                        + "}";
            } catch (Exception e) {
                Log.w(TAG, "getInfo failed", e);
                return "{}";
            }
        }

        /**
         * JS 主动调 Java：用原生 Intent 打开外部浏览器
         *
         * 解决 WebView 看到裸域名(如 "cos.svf.dpdns.org")时把它包装成
         *   intent://cos.svf.dpdns.org#Intent;scheme=https;...;end
         * 再用 shouldOverrideUrlLoading 启动系统浏览器时,系统对这种
         * "intent://..." URL 解析失败,导致 net::ERR_UNKNOWN_URL_SCHEME。
         *
         * 这里直接用 startActivity(new Intent(ACTION_VIEW, Uri.parse(url)))
         * 走标准 Intent 流程,绕开 WebView 的 intent:// 包装。
         *
         * @param url 完整 http/https URL
         * @return true 成功启动 Intent;false 启动失败(没装浏览器 / 参数异常)
         */
        @android.webkit.JavascriptInterface
        public boolean openExternalBrowser(final String url) {
            try {
                if (url == null || url.length() == 0) return false;
                final String trimmed = url.trim();
                if (trimmed.length() == 0) return false;
                String lower = trimmed.toLowerCase();
                if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
                    Log.w(TAG, "[外部浏览器] 拒绝非 http(s) 协议: " + trimmed);
                    return false;
                }
                final Activity activity = PythonActivity.mActivity;
                if (activity == null) {
                    Log.w(TAG, "[外部浏览器] mActivity 为空,无法启动");
                    return false;
                }
                final android.net.Uri uri = android.net.Uri.parse(trimmed);
                if (uri == null) return false;
                final Intent baseIntent = new Intent(Intent.ACTION_VIEW, uri);
                baseIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                // 已移除错误的 FLAG_ACTIVITY_REQUIRE_NON_BROWSER（该标志要求非浏览器处理，与打开浏览器相反）
                final Activity act = activity;
                act.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent chooser = Intent.createChooser(baseIntent, "选择浏览器打开");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            act.startActivity(chooser);
                            Log.i(TAG, "[外部浏览器] 已启动 chooser: " + trimmed);
                        } catch (android.content.ActivityNotFoundException e) {
                            Log.e(TAG, "[外部浏览器] 未找到可处理该链接的应用", e);
                            try {
                                android.widget.Toast.makeText(act, "未找到可打开链接的浏览器", android.widget.Toast.LENGTH_SHORT).show();
                            } catch (Exception ignored) {}
                            try {
                                act.startActivity(baseIntent);
                            } catch (Exception e2) {
                                Log.e(TAG, "[外部浏览器] 降级启动也失败", e2);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "[外部浏览器] startActivity 失败", e);
                            try {
                                android.widget.Toast.makeText(act, "打开外部浏览器失败: " + e.getMessage(), android.widget.Toast.LENGTH_SHORT).show();
                            } catch (Exception ignored) {}
                        }
                    }
                });
                return true;
            } catch (Exception e) {
                Log.e(TAG, "[外部浏览器] 调用异常", e);
                return false;
            }
        }
    }
}
