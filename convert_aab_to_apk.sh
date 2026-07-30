#!/bin/bash

# 1. 先尝试找 APK
APK_PATH=$(find bin/ -name "*.apk" | head -1)

if [ -n "$APK_PATH" ]; then
  echo "Found APK directly: $APK_PATH"
  echo "apk_path=$APK_PATH" >> $GITHUB_OUTPUT
else
  echo "No APK found, trying to convert from AAB..."
  
  # 查找 AAB 文件
  AAB_PATH=$(find bin/ -name "*.aab" | head -1)
  if [ -z "$AAB_PATH" ]; then
    echo "Error: No APK or AAB file found in bin/"
    ls -la bin/ || true
    exit 1
  fi
  echo "Found AAB: $AAB_PATH"
  
  # 下载 bundletool
  wget -q https://github.com/google/bundletool/releases/download/1.15.4/bundletool-all-1.15.4.jar -O bundletool.jar
  
  # 从 buildozer.spec 中读取签名信息
  KEY_ALIAS=$(grep "^android.keystore_alias" buildozer.spec | cut -d'=' -f2 | tr -d ' ')
  STORE_PASS=$(grep "^android.keystore_storepass" buildozer.spec | cut -d'=' -f2 | tr -d ' ')
  KEY_PASS=$(grep "^android.keystore_keypass" buildozer.spec | cut -d'=' -f2 | tr -d ' ')
  KEYSTORE_PATH="./com.lanplay.monitor.keystore"
  
  echo "Using alias: $KEY_ALIAS"
  
  # 使用 bundletool 生成 APKs 集合
  java -jar bundletool.jar build-apks \
    --bundle="$AAB_PATH" \
    --output=bin/output.apks \
    --mode=universal \
    --ks="$KEYSTORE_PATH" \
    --ks-key-alias="$KEY_ALIAS" \
    --ks-pass=pass:"$STORE_PASS" \
    --key-pass=pass:"$KEY_PASS"
  
  # 解压并重命名
  unzip -o bin/output.apks -d bin/
  mv bin/universal.apk bin/monitor-${VERSION:-1.0.1}-release.apk
  echo "Successfully converted AAB to APK"
  echo "apk_path=bin/monitor-${VERSION:-1.0.1}-release.apk" >> $GITHUB_OUTPUT
fi
