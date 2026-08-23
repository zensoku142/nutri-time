// ==================== 手机与手表调试签名 ====================
// Config plugin（生成 Android 工程时自动修改原生配置的小工具）只处理本机调试证书路径。
// 手机和手表都读取用户目录中的同一张 debug.keystore，因此可以匹配签名且不用提交密钥文件。

const {withAppBuildGradle} = require('expo/config-plugins');

const generatedDebugKeystore = "storeFile file('debug.keystore')";
const sharedDebugKeystore =
  'storeFile file(System.getProperty("user.home") + "/.android/debug.keystore")';

module.exports = function withSharedDebugKeystore(config) {
  return withAppBuildGradle(config, gradleConfig => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('NutriTime 调试签名配置只支持 Expo 生成的 Groovy build.gradle。');
    }

    const buildGradle = gradleConfig.modResults.contents;

    // Expo 模板变化时主动停止，避免插件悄悄失效后生成一张与手表不同的调试证书。
    if (!buildGradle.includes(generatedDebugKeystore)) {
      throw new Error('未找到 Expo 默认 debug.keystore 配置，请检查 SDK 模板是否已变化。');
    }

    gradleConfig.modResults.contents = buildGradle.replace(
      generatedDebugKeystore,
      sharedDebugKeystore,
    );

    return gradleConfig;
  });
};
