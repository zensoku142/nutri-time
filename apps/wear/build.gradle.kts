// 根构建文件只声明所有子工程共用的插件，具体应用设置保留在 app 模块中。
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
}
