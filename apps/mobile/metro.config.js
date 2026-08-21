const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// ==================== JavaScript 打包配置 ====================
// Metro（把多个代码文件打成手机应用资源的工具）目前完全沿用 React Native 默认设置。
// 保留空的自定义对象，今后确有特殊资源类型时可在这里追加，并继续与官方默认值合并。
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
