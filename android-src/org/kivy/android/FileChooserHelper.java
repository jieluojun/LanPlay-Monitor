package org.kivy.android;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

/**
 * 为 p4a webview bootstrap 的 WebView 安装 WebChromeClient，
 * 使页面中的 <input type="file">（图片/视频选择）能够唤起系统相册/视频选择器。
 *
 * 为什么必须放在 org.kivy.android 包下：
 *   PythonActivity.mWebView 是 protected 静态字段，只有同包的类能直接访问；
 *   PythonActivity 自带 ActivityResultListener 注册机制，正好用来接收选择结果，
 *   无需修改 python-for-android 源码、无需维护 fork。
 *
 * 调用方式（Python/pyjnius，在 PythonActivity 启动后）：
 *   autoclass("org.kivy.android.FileChooserHelper").install()
 *   返回 true 表示 WebView 已存在且安装成功；返回 false 表示 WebView 尚未创建，
 *   稍后重试即可（startActivityForResult 在 UI 线程上执行）。
 */
public class FileChooserHelper {

    private static final String TAG = "FileChooserHelper";
    private static final int FILECHOOSER_RESULTCODE = 5173;

    private static ValueCallback<Uri[]> mUploadMessage = null;
    private static boolean mInstalled = false;

    public static boolean install() {
        final PythonActivity activity = PythonActivity.mActivity;
        final WebView webView = PythonActivity.mWebView;
        if (activity == null || webView == null) {
            // App 还在解包/启动阶段，WebView 尚未创建，让调用方稍后重试
            return false;
        }
        if (mInstalled) {
            return true;
        }
        mInstalled = true;

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public boolean onShowFileChooser(WebView view,
                            ValueCallback<Uri[]> filePathCallback,
                            WebChromeClient.FileChooserParams params) {
                        // 若上一次的回调还挂着（用户没选完），先释放掉，
                        // 否则 WebView 内部状态会卡住，之后点按钮全部无反应
                        if (mUploadMessage != null) {
                            mUploadMessage.onReceiveValue(null);
                            mUploadMessage = null;
                        }
                        mUploadMessage = filePathCallback;

                        Intent intent;
                        try {
                            // createIntent() 自动带上 accept="image/*,video/*" 的 MIME 过滤
                            intent = params.createIntent();
                            if (params.getMode()
                                    == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                            }
                        } catch (Exception e) {
                            // 兜底：手动构造"图片+视频"选择 Intent
                            intent = new Intent(Intent.ACTION_GET_CONTENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType("*/*");
                            intent.putExtra(Intent.EXTRA_MIME_TYPES,
                                    new String[]{"image/*", "video/*"});
                            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                        }
                        try {
                            activity.startActivityForResult(intent, FILECHOOSER_RESULTCODE);
                        } catch (ActivityNotFoundException e) {
                            Log.e(TAG, "设备上没有可用的文件选择器", e);
                            mUploadMessage = null;
                            return false;
                        }
                        return true;
                    }
                });

                // 接收系统选择器返回的结果（PythonActivity 自带的 Listener 机制，
                // 在其 onActivityResult 中统一分发）
                activity.registerActivityResultListener(
                        new PythonActivity.ActivityResultListener() {
                            @Override
                            public void onActivityResult(int requestCode, int resultCode,
                                    Intent data) {
                                if (requestCode != FILECHOOSER_RESULTCODE
                                        || mUploadMessage == null) {
                                    return;
                                }
                                Uri[] results = null;
                                if (resultCode == Activity.RESULT_OK && data != null) {
                                    ClipData clip = data.getClipData();
                                    if (clip != null && clip.getItemCount() > 0) {
                                        // 多选（input multiple）
                                        int n = clip.getItemCount();
                                        results = new Uri[n];
                                        for (int i = 0; i < n; i++) {
                                            results[i] = clip.getItemAt(i).getUri();
                                        }
                                    } else if (data.getData() != null) {
                                        // 单选
                                        results = new Uri[]{data.getData()};
                                    } else if (data.getDataString() != null) {
                                        results = new Uri[]{Uri.parse(data.getDataString())};
                                    }
                                }
                                // 取消选择时 results 为 null —— 必须回传以解锁 WebView
                                mUploadMessage.onReceiveValue(results);
                                mUploadMessage = null;
                            }
                        });
                Log.i(TAG, "WebChromeClient (file chooser) installed");
            }
        });
        return true;
    }
}
