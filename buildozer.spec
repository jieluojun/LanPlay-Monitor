[app]
title = LanPlayMonitor
package.name = monitor
package.domain = com.lanplay
source.dir = .
source.include_exts = py, png, jpg, kv, atlas, ttf, json, html, css, js
source.include_patterns = image/*, presplash.png, icon.png, assets/*
version = 1.0.0

icon.filename = icon.png
# 锁定竖屏
orientation = portrait
entrypoint = main.py

# ===== 启动图配置 =====
# presplash.png 必须真实存在于项目根目录，背景实色 #DFF3FF，不要透明，否则会透出系统默认动态图
presplash.filename = presplash.png
fullscreen = 1
# 浅色背景，与网页浅色一致（Native presplash 背景色）
android.presplash_color = #DFF3FF
# Android 12+ 新闪屏背景（与 styles.xml 中 windowSplashScreenBackground 保持一致）
android.splash_background_color = #DFF3FF
# 禁用 p4a 默认的加载动画 lottie（p4a develop 分支；留空禁用动态图标，避免覆盖静态 presplash）
# android.presplash_lottie =

# --- 关键：覆盖 p4a webview bootstrap 的 _load.html（三根紫柱加载页） ---
# 使用 source:destination 显式映射，把 _load.html 和 _loading_style.css
# 直接打入 APK 的 assets/ 根目录（替换 p4a 默认三根紫色柱），
# 避免打包出重复的 assets/assets/ 路径导致自定义启动页失效。
android.add_assets = assets/_load.html:_load.html, assets/_loading_style.css:_loading_style.css, assets/_presplash.png:_presplash.png
# ===================================================================

requirements = python3, pyjnius

android.accept_sdk_license = True
android.allow_api_min = 21
android.api = 33
android.minapi = 21
android.ndk = 25b
android.sdk = 33
android.ndk_api = 21

# 加入自定义 Java 源码目录（内含 org/kivy/android/*.java）
android.add_src = ./android-src

# 设置权限
android.permissions = INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, VIBRATE, ACCESS_NETWORK_STATE, READ_EXTERNAL_STORAGE, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO, CAMERA

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

# 禁止构建时将 py 编译为 pyc，APK 内保留 py 源码
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
