# Kivy Android APK Builder

使用GitHub Actions自动构建Kivy Android APK/AAB的模板仓库。

## 使用方法

### 0. fork本仓库或使用此模板

先给个star可以吗?

QAQ

### 1. 配置项目

确保项目根目录包含 `buildozer.spec` (自行修改参数),`main.py`(无语法错误,可在python3.9正常运行)和依赖文件(使用`相对路径`调用,避免中文文件名)。

将`buildozer.spec`和`release.yml`中`RepositoryName`,`DomainName`,`PackageName`替换。

### 2. 设置工作流程
本仓库提供两个工作流程:

- **`release.yml`** - 发布模式（签名AAB）
- **`debug.yml`** - 调试模式（未签名APK）

手动触发构建,流程约15分钟。

### 3. 获取构建产物
构建完成后,在Actions页面下载:

- **APK/AAB 文件** - 安装包
- **构建日志** - 调试信息
- **签名密钥** - 用于发布,妥善保存
