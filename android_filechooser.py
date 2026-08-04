#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android WebView 文件选择/录音支持 v5（主线程同步安装，解决 JNI ClassLoader 跨线程问题）
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
    """供 main.py 的 /api/logs 在最底部常驻展示"""
    if not _STATUS_LOGS:
        return ["[文件选择] 状态: 未执行 android_filechooser.install()"]
    return list(_STATUS_LOGS)


def install() -> bool:
    """必须在 main.py 主线程启动时同步调用（切勿在 Python 子线程里调 autoclass，否则 Android JNI 会报 ClassNotFoundException）"""
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
        _log("请检查 buildozer.spec 的 requirements 是否包含 pyjnius")
        return False

    try:
        Helper = autoclass("org.kivy.android.FileChooserHelper")
        _log("FileChooserHelper 类加载成功")
    except Exception as exc:
        _log(f"❌ FileChooserHelper 类加载失败: {exc!r}")
        _log("原因：Java 类未找到。请确认 android-src/org/kivy/android/FileChooserHelper.java 已 git add 提交，且 spec 中有 android.add_src = ./android-src")
        return False

    try:
        ok = bool(Helper.install())
        if ok:
            _log("✅ WebChromeClient 已成功挂载到 WebView！（相册/视频选择 + 麦克风录音已启用）")
            return True
        else:
            _log("⚠️ Helper.install() 返回 false（PythonActivity 或 WebView 未就绪）")
            return False
    except Exception as exc:
        _log(f"❌ Helper.install() 启动失败: {exc!r}")
        return False


# 兼容函数名
install_async = install
