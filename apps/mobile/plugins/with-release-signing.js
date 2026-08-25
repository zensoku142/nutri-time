// ==================== 手机正式签名 ====================
// Config plugin（生成 Android 工程时自动修改原生配置的小工具）只写入环境变量名称，不保存密钥或密码。
// 正式构建缺少任意一项凭据时会主动停止，避免误把 Debug 证书签名的 APK 发布给用户。

const {withAppBuildGradle} = require('expo/config-plugins');

const androidBlockStart = 'android {';
const signingConfigsStart = '    signingConfigs {';
const debugSigningConfigStart = '        debug {';
const generatedReleaseSigning = '            signingConfig signingConfigs.debug';

const releaseSigningVariables = `def nutriTimeReleaseSigning = [
    storeFile: System.getenv("NUTRITIME_RELEASE_STORE_FILE"),
    storePassword: System.getenv("NUTRITIME_RELEASE_STORE_PASSWORD"),
    keyAlias: System.getenv("NUTRITIME_RELEASE_KEY_ALIAS"),
    keyPassword: System.getenv("NUTRITIME_RELEASE_KEY_PASSWORD"),
]
def nutriTimeHasReleaseSigning = nutriTimeReleaseSigning.values().every { it }
def nutriTimeReleaseBuildRequested = gradle.startParameter.taskNames.any {
    it.toLowerCase().contains("release")
}

// Release 任务必须拿到四项正式凭据；Debug 构建不读取它们，日常开发不受影响。
if (nutriTimeReleaseBuildRequested && !nutriTimeHasReleaseSigning) {
    throw new GradleException("NutriTime Release 构建缺少正式签名环境变量。")
}

`;

const releaseSigningConfig = `        if (nutriTimeHasReleaseSigning) {
            release {
                storeFile file(nutriTimeReleaseSigning.storeFile)
                storePassword nutriTimeReleaseSigning.storePassword
                keyAlias nutriTimeReleaseSigning.keyAlias
                keyPassword nutriTimeReleaseSigning.keyPassword
            }
        }
`;

const guardedReleaseSigning = `            // 正式包只能使用上面的私有 Release 证书，不能退回 Debug 证书。
            if (nutriTimeHasReleaseSigning) {
                signingConfig signingConfigs.release
            }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, gradleConfig => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('NutriTime 正式签名配置只支持 Expo 生成的 Groovy build.gradle。');
    }

    let buildGradle = gradleConfig.modResults.contents;

    // 精确检查 Expo 模板中的三个锚点；模板变化后宁可停止，也不能生成签名来源不明的正式包。
    if (
      !buildGradle.includes(androidBlockStart) ||
      !buildGradle.includes(signingConfigsStart) ||
      !buildGradle.includes(generatedReleaseSigning)
    ) {
      throw new Error('未找到 Expo 默认 Release 签名配置，请检查 SDK 模板是否已变化。');
    }

    buildGradle = buildGradle.replace(
      androidBlockStart,
      `${releaseSigningVariables}${androidBlockStart}`,
    );
    buildGradle = buildGradle.replace(
      `${signingConfigsStart}\n${debugSigningConfigStart}`,
      `${signingConfigsStart}\n${releaseSigningConfig}${debugSigningConfigStart}`,
    );
    // Expo 的 Debug 和 Release 块都有同一行签名配置；最后一次出现才属于 Release。
    const releaseSigningIndex = buildGradle.lastIndexOf(generatedReleaseSigning);
    buildGradle = `${buildGradle.slice(0, releaseSigningIndex)}${guardedReleaseSigning}${buildGradle.slice(
      releaseSigningIndex + generatedReleaseSigning.length,
    )}`;

    gradleConfig.modResults.contents = buildGradle;
    return gradleConfig;
  });
};
