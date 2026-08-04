#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android WebView 文件选择支持（配合 FileChooserHelper.java 使用）

背景：buildozer / python-for-android 的 `webview` bootstrap 只给 WebView
设置了 WebViewClient，没有实现 WebChromeClient.onShowFileChooser，
导致页面里的 <input type="file"> 点击后系统相册/视频选择器不会弹出。

本模块在 App 启动时通过 pyjnius 调用 org.kivy.android.FileChooserHelper.install()
为 WebView 补上该能力。非 Android 环境（桌面/服务器调试）自动跳过，零副作用。

部署要求（见 README）：
  1. buildozer.spec: requirements 中包含 pyjnius
  2. buildozer.spec: android.add_src 指向包含
     org/kivy/android/FileChooserHelper.java 的源码目录（如 ./android-src）
"""
from __future__ import annotations

import os
import threading
import time

_installed = False
_lock = threading.Lock()


def install_async(max_wait_s: float = 90.0) -> None:
    """后台安装 WebChromeClient；仅 Android 生效，可重复调用（幂等）。"""
    global _installed
    if not os.environ.get("ANDROID_APP_PATH"):
        return  # 桌面/服务器环境，直接跳过
    with _lock:
        if _installed:
            return
        _installed = True
    t = threading.Thread(
        target=_install_worker,
        args=(max_wait_s,),
        daemon=True,
        name="filechooser-installer",
    )
    t.start()


def _install_worker(max_wait_s: float) -> None:
    try:
        from jnius import autoclass
        Helper = autoclass("org.kivy.android.FileChooserHelper")
    except Exception as exc:
        print(f"[文件选择] 加载 FileChooserHelper 失败: {exc}")
        print("[文件选择] 请确认 buildozer.spec 的 requirements 含 pyjnius，"
              "且 android.add_src 已包含 FileChooserHelper.java")
        return

    deadline = time.time() + max_wait_s
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            # install() 返回 False 表示 WebView 还没创建好（启动解包阶段），轮询等待
            if Helper.install():
                print("[文件选择] ✅ WebView 文件选择（相册/视频）已启用")
                return
        except Exception as exc:
            print(f"[文件选择] 安装失败: {exc}")
            return
        time.sleep(1.0)
    print("[文件选择] ⚠️ 等待 WebView 创建超时，文件选择未启用")
