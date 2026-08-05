package org.kivy.android;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.graphics.Color;
import android.widget.ImageView;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 为 p4a webview bootstrap 的 WebView 安装 WebChromeClient：
 *   1. 启动画面（3 秒）
 *   2. 系统状态栏颜色同步主题
 *   3. 主动请求不受电池优化限制
 *   4. <input type="file"> 文件选择
 *   5. getUserMedia 麦克风授权
 *   6. Blob / data: URL 下载拦截 → 原生保存到 Downloads
 */
public class FileChooserHelper {
    private static final String TAG = "FileChooserHelper";
    private static final int FILECHOOSER_RESULTCODE = 5173;
    private static final int PERMISSION_REQ_RECORD_AUDIO = 5174;
    private static final int PERMISSION_REQ_STORAGE = 5175;
    private static final int PERMISSION_REQ_BATTERY = 5176;
    private static final int REQUEST_IGNORE_BATTERY = 5177;
    private static final long SPLASH_DURATION_MS = 3000;

    private static ValueCallback<Uri[]> mUploadMessage = null;
    private static boolean mInstalled = false;
    private static View mSplashView = null;

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

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // ========== 1. 启动画面 ==========
                    showSplash(activity);

                    // ========== 2. 状态栏颜色同步主题 ==========
                    syncStatusBarColor(activity, false);

                    // ========== 3. 请求不受电池优化限制 ==========
                    requestIgnoreBatteryOptimization(activity);

                    // ========== 4. 动态权限 ==========
                    requestRuntimePermissions(activity);

                    // ========== 5. 设置 WebChromeClient ==========
                    webView.setWebChromeClient(new WebChromeClient() {

                        // ---- 文件选择 ----
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
                                Log.w(TAG, "params.createIntent() failed, fallback", e);
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
                                    contentIntent.putExtra(Intent.EXTRA_MIME_TYPES,
                                            new String[]{"image/*", "video/*", "audio/*", "application/*"});
                                }
                                contentIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                            }

                            Intent chooserIntent = Intent.createChooser(contentIntent, "选择文件或媒体");
                            try {
                                activity.startActivityForResult(chooserIntent, FILECHOOSER_RESULTCODE);
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

                        // ---- getUserMedia 麦克风 ----
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            Log.i(TAG, "onPermissionRequest: " + java.util.Arrays.toString(request.getResources()));
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
                                        Log.e(TAG, "onPermissionRequest error", e);
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

                    // ========== 6. 拦截 Blob / data: 下载 ==========
                    webView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, String url) {
                            if (url == null) return false;
                            if (url.startsWith("blob:") || url.startsWith("data:")) {
                                Log.i(TAG, "Intercepted download URL: " + url.substring(0, Math.min(80, url.length())));
                                downloadAndSave(activity, webView, url);
                                return true;
                            }
                            return false;
                        }
                    });

                    // ========== 注册 Activity 结果监听 ==========
                    activity.registerActivityResultListener(
                            new PythonActivity.ActivityResultListener() {
                                @Override
                                public void onActivityResult(int requestCode, int resultCode, Intent data) {
                                    if (requestCode == FILECHOOSER_RESULTCODE && mUploadMessage != null) {
                                        Uri[] results = null;
                                        if (resultCode == Activity.RESULT_OK && data != null) {
                                            ClipData clip = data.getClipData();
                                            if (clip != null && clip.getItemCount() > 0) {
                                                results = new Uri[clip.getItemCount()];
                                                for (int i = 0; i < clip.getItemCount(); i++) {
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
                                        Log.i(TAG, "FileChooser result handled, count=" +
                                                (results != null ? results.length : 0));
                                    } else if (requestCode == REQUEST_IGNORE_BATTERY) {
                                        Log.i(TAG, "Battery optimization setting result: " + resultCode);
                                    }
                                }
                            });

                    // ========== 7. 监听主题变化，同步状态栏 ==========
                    webView.addJavascriptInterface(new Object() {
                        @android.webkit.JavascriptInterface
                        public void setStatusBarColor(final String hex) {
                            activity.runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        int color = Color.parseColor(hex);
                                        syncStatusBarColor(activity, isDarkColor(color));
                                    } catch (Exception e) {
                                        Log.w(TAG, "Invalid color: " + hex, e);
                                    }
                                }
                            });
                        }
                    }, "AndroidBridge");

                    Log.i(TAG, "✅ FileChooserHelper installed (splash=3s, statusbar, battery, blob-save)");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to install FileChooserHelper", e);
                }
            }
        });
        return true;
    }

    // ===================== 启动画面 =====================
    private static void showSplash(final Activity activity) {
        try {
            FrameLayout root = (FrameLayout) activity.findViewById(android.R.id.content);
            if (root == null) return;

            ImageView splash = new ImageView(activity);
            splash.setBackgroundColor(Color.parseColor("#dff3ff")); // 浅色主题背景
            splash.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
            // 若想显示图标，可换成 BitmapDrawable
            splash.setImageResource(android.R.drawable.sym_def_app_icon);

            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT);
            splash.setLayoutParams(lp);
            splash.setClickable(true);
            splash.setFocusable(true);

            root.addView(splash);
            mSplashView = splash;

            // 3 秒后淡出
            splash.postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        splash.animate()
                                .alpha(0f)
                                .setDuration(500)
                                .withEndAction(new Runnable() {
                                    @Override
                                    public void run() {
                                        FrameLayout r = (FrameLayout) activity.findViewById(android.R.id.content);
                                        if (r != null) r.removeView(splash);
                                        if (mSplashView == splash) mSplashView = null;
                                    }
                                })
                                .start();
                    } catch (Exception e) {
                        Log.w(TAG, "Splash dismiss error", e);
                    }
                }
            }, SPLASH_DURATION_MS);
            Log.i(TAG, "Splash shown for " + SPLASH_DURATION_MS + "ms");
        } catch (Exception e) {
            Log.w(TAG, "showSplash failed", e);
        }
    }

    // ===================== 状态栏颜色 =====================
    private static void syncStatusBarColor(Activity activity, boolean darkTheme) {
        try {
            Window window = activity.getWindow();
            if (window == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                int color = darkTheme ? Color.parseColor("#0f1923") : Color.parseColor("#dff3ff");
                window.setStatusBarColor(color);
            }
            // 浅色背景 → 深色文字；深色背景 → 浅色文字
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                View decor = window.getDecorView();
                int flags = decor.getSystemUiVisibility();
                if (darkTheme) {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                } else {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                }
                decor.setSystemUiVisibility(flags);
            }
            Log.i(TAG, "Status bar synced, dark=" + darkTheme);
        } catch (Exception e) {
            Log.w(TAG, "syncStatusBarColor failed", e);
        }
    }

    private static boolean isDarkColor(int color) {
        // 计算相对亮度
        int r = (color >> 16) & 0xFF;
        int g = (color >> 8) & 0xFF;
        int b = color & 0xFF;
        double luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance < 140;
    }

    // ===================== 电池优化豁免 =====================
    private static void requestIgnoreBatteryOptimization(final Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        try {
            String pkg = activity.getPackageName();
            PowerManager pm = (PowerManager) activity.getSystemService(Activity.POWER_SERVICE);
            if (pm == null) return;

            if (!pm.isIgnoringBatteryOptimizations(pkg)) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    activity.startActivityForResult(intent, REQUEST_IGNORE_BATTERY);
                    Log.i(TAG, "Requesting battery optimization exemption");
                } catch (ActivityNotFoundException e) {
                    Log.w(TAG, "Battery settings not available", e);
                }
            } else {
                Log.i(TAG, "Already ignoring battery optimizations");
            }
        } catch (Exception e) {
            Log.w(TAG, "requestIgnoreBatteryOptimization failed", e);
        }
    }

    // ===================== 运行时权限 =====================
    private static void requestRuntimePermissions(final Activity activity) {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            java.util.ArrayList<String> needed = new java.util.ArrayList<>();
            if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.RECORD_AUDIO);
            }
            if (activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
            if (activity.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.READ_EXTERNAL_STORAGE);
            }
            if (!needed.isEmpty()) {
                activity.requestPermissions(needed.toArray(new String[0]), PERMISSION_REQ_STORAGE);
                Log.i(TAG, "Requesting permissions: " + needed);
            }
        } catch (Exception e) {
            Log.w(TAG, "requestRuntimePermissions failed", e);
        }
    }

    // ===================== Blob / data: 下载拦截 =====================
    private static final ExecutorService sDownloadExecutor = Executors.newSingleThreadExecutor();

    private static void downloadAndSave(final Activity activity, final WebView webView, final String url) {
        sDownloadExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    byte[] data;
                    String mimeType;
                    String fileName;

                    if (url.startsWith("data:")) {
                        // data: URI → 直接解码
                        int comma = url.indexOf(',');
                        if (comma < 0) return;
                        String header = url.substring(5, comma);
                        String payload = url.substring(comma + 1);
                        boolean base64 = header.contains(";base64");
                        mimeType = header.split(";")[0];
                        if (mimeType.isEmpty()) mimeType = "application/octet-stream";

                        if (base64) {
                            data = android.util.Base64.decode(payload, android.util.Base64.DEFAULT);
                        } else {
                            data = java.net.URLDecoder.decode(payload, "UTF-8").getBytes("UTF-8");
                        }
                        fileName = "download_" + System.currentTimeMillis() + guessExt(mimeType);
                    } else if (url.startsWith("blob:")) {
                        // blob: 通过 JS fetch → base64 桥接拿到字节
                        fileName = "blob_" + UUID.randomUUID().toString().substring(0, 8) + ".bin";
                        mimeType = "application/octet-stream";
                        // 让 WebView 在主线程 fetch 后回调
                        final String[] b64Holder = new String[1];
                        activity.runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                webView.evaluateJavascript(
                                        "(function(){fetch('" + url + "').then(r=>r.blob()).then(b=>new Promise((res)=>{"
                                                + "const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(b);"
                                                + "})).then(d=>AndroidBridge.onBlobData(d));})();",
                                        null);
                            }
                        });
                        // 简化：这里直接下载为空，真正的数据走 JS 桥接
                        // 完整实现见下方 onBlobData 回调
                        data = new byte[0];
                    } else {
                        return;
                    }

                    if (data.length > 0) {
                        saveToFile(activity, data, fileName, mimeType);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "downloadAndSave failed", e);
                    showToast(activity, "下载失败: " + e.getMessage());
                }
            }
        });
    }

    /** JS 桥接回调：接收 base64 编码的 blob 数据 */
    @android.webkit.JavascriptInterface
    public static void onBlobData(final String dataUrl) {
        final Activity activity = PythonActivity.mActivity;
        if (activity == null || dataUrl == null) return;
        sDownloadExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    int comma = dataUrl.indexOf(',');
                    if (comma < 0) return;
                    String header = dataUrl.substring(5, comma);
                    String payload = dataUrl.substring(comma + 1);
                    String mimeType = header.split(";")[0];
                    if (mimeType.isEmpty()) mimeType = "application/octet-stream";
                    boolean base64 = header.contains(";base64");
                    byte[] data = base64
                            ? android.util.Base64.decode(payload, android.util.Base64.DEFAULT)
                            : java.net.URLDecoder.decode(payload, "UTF-8").getBytes("UTF-8");

                    String fileName = "blob_" + System.currentTimeMillis() + guessExt(mimeType);
                    saveToFile(activity, data, fileName, mimeType);
                } catch (Exception e) {
                    Log.e(TAG, "onBlobData failed", e);
                }
            }
        });
    }

    private static void saveToFile(Activity activity, byte[] data, String fileName, String mimeType) {
        try {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, fileName);
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(data);
            }
            Log.i(TAG, "Saved " + data.length + " bytes → " + out.getAbsolutePath());
            showToast(activity, "已保存到下载: " + fileName);

            // 通知媒体扫描
            Intent scan = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
            scan.setData(Uri.fromFile(out));
            activity.sendBroadcast(scan);
        } catch (Exception e) {
            Log.e(TAG, "saveToFile failed", e);
            showToast(activity, "保存失败: " + e.getMessage());
        }
    }

    private static String guessExt(String mime) {
        if (mime == null) return ".bin";
        switch (mime) {
            case "image/png": return ".png";
            case "image/jpeg": return ".jpg";
            case "image/gif": return ".gif";
            case "image/webp": return ".webp";
            case "video/mp4": return ".mp4";
            case "audio/mpeg": return ".mp3";
            case "audio/wav": return ".wav";
            case "application/pdf": return ".pdf";
            case "application/json": return ".json";
            case "text/plain": return ".txt";
            default: return ".bin";
        }
    }

    private static void showToast(final Activity activity, final String msg) {
        if (activity == null) return;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Toast.makeText(activity, msg, Toast.LENGTH_LONG).show();
                } catch (Exception ignored) {}
            }
        });
    }
}
