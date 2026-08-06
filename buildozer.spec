[app]
title = LanPlayMonitor
package.name = monitor
package.domain = com.lanplay
source.dir = .
source.include_exts = py, png, jpg, kv, atlas, ttf, json, html, css, js
source.include_patterns = image/*
version = 1.0.0

icon.filename = icon.png
# presplash.filename = presplash.png
fullscreen = 0
orientation = portrait
entrypoint = main.py

# ★ 改动 1：加入 pyjnius（Python 调用 Java 桥 FileChooserHelper 所必需）
requirements = python3, pyjnius

android.accept_sdk_license = True
android.allow_api_min = 21
android.api = 33
android.minapi = 21
android.ndk = 25b
android.sdk = 33
android.ndk_api = 21

# ★ 改动 2：加入自定义 Java 源码目录（内含
#  org/kivy/android/FileChooserHelper.java，为 WebView 补上文件选择功能）
android.add_src = ./android-src
android.permissions = INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS

# 强制使用特定架构
android.archs = arm64-v8a

android.gradle_download = https://services.gradle.org/distributions/gradle-7.6.4-all.zip
android.gradle_plugin = 7.4.2

p4a.branch = develop
p4a.gradle_dependencies = gradle:7.6.4, androidx.webkit:webkit:1.9.0
p4a.gradle_options = -Dorg.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64
# ===== WebView 配置 =====
p4a.bootstrap = webview
p4a.port = 5000
# ========================

# ★ 改动 3：禁止构建时将 py 编译为 pyc，APK 内保留 py 源码
# 配合你现在的远程更新（py源码对比+清理旧__pycache__）可彻底避免 3.14 vs 3.13 Bad magic 白屏
# 需配合本地 fork 的 python-for-android 使用，见下方说明
# p4a.source_dir = ./python-for-android
# p4a 的新参数，旧版可用 android.no-byte-compile-python = True 兼容
android.no-byte-compile-python = True
p4a.args = --no-compile-pyo

exclude_patterns = **/test/*, **/tests/*
android.aab = False
package.format = apk

# 签名配置
android.keystore = ./com.lanplay.monitor.keystore
android.keystore_storepass = android
android.keystore_keypass = android
android.keystore_alias = com.lanplay.monitor

[buildozer]
log_level = 2
warn_on_root = 1
