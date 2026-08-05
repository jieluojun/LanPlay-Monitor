#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android WebView 文件选择/录音/主题/电池/下载 支持 v6
配合 android-src/org/kivy/android/FileChooserHelper.java 使用。
"""
from __future__ import annotations
import os
_STATUS_LOGS: list[str] = []

def _log(msg: str) -> None:
    full_msg = f"[文件选择] {msg}"
    print(full_msg)
    _STATUS_LOGS.append(full_msg)

def get_status_logs() -> list[str]:
    if not _STATUS_LOGS:
        return ["[文件选择] 状态: 未执行 android_filechooser.install()"]
    return list(_STATUS_LOGS)

def install() -> bool:
    """必须在主线程同步调用"""
    _STATUS_LOGS.clear()
    app_path = os.environ.get("ANDROID_APP_PATH")
    _log(f"install() 被调用, ANDROID_APP_PATH={app_path!r}")
    if not app_path:
        _log("非 Android 真机环境（桌面调试），跳过原生挂载")
        return False
    try:
        from jnius import autoclass
        _log("pyjnius 导入成功")
    except Exception as exc:
        _log(f"❌ pyjnius 导入失败: {exc!r}")
        return False
    try:
        Helper = autoclass("org.kivy.android.FileChooserHelper")
        _log("FileChooserHelper 类加载成功")
    except Exception as exc:
        _log(f"❌ FileChooserHelper 类加载失败: {exc!r}")
        return False
    try:
        ok = bool(Helper.install())
        if ok:
            _log("✅ WebChromeClient 已挂载（启动画面/状态栏/电池/文件选择/下载均已启用）")
            # 通知前端深色模式跟随系统
            try:
                import webview_bridge
                webview_bridge.eval_js("""
                    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                        document.documentElement.classList.add('dark');
                        if (window.AndroidBridge) AndroidBridge.setStatusBarColor('#0f1923');
                    } else {
                        document.documentElement.classList.remove('dark');
                        if (window.AndroidBridge) AndroidBridge.setStatusBarColor('#dff3ff');
                    }
                """)
            except Exception:
                pass
            return True
        else:
            _log("⚠️ Helper.install() 返回 false")
            return False
    except Exception as exc:
        _log(f"❌ Helper.install() 启动失败: {exc!r}")
        return False

install_async = install
