package org.kivy.android;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

/**
 * 为 p4a webview bootstrap 的 WebView 安装 WebChromeClient：
 *   1. <input type="file">：用 Intent.createChooser 唤起系统相册/视频/文件选择器
 *   2. getUserMedia 麦克风：自动批准 WebView 麦克风请求，并向 Android 系统申请 RECORD_AUDIO 权限
 */
public class FileChooserHelper {

    private static final String TAG = "FileChooserHelper";
    private static final int FILECHOOSER_RESULTCODE = 5173;
    private static final int PERMISSION_REQ_RECORD_AUDIO = 5174;

    private static ValueCallback<Uri[]> mUploadMessage = null;
    private static boolean mInstalled = false;

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
                    webView.setWebChromeClient(new WebChromeClient() {

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

                            // 关键优化：使用 Intent.createChooser 包装，兼容所有国产 ROM（小米/华为/OPPO/vivo等）
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

                    Log.i(TAG, "✅ FileChooserHelper WebChromeClient installed successfully!");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to install WebChromeClient in runOnUiThread", e);
                }
            }
        });
        return true;
    }
}
