const {getDefaultConfig} = require('expo/metro-config');

// ==================== JavaScript 打包配置 ====================
// Metro（把多个代码文件打成手机应用资源的工具）改用 Expo 默认设置。
// 这样 Development Build 能识别 Expo 模块，同时保留 React Native 原有的打包行为。
module.exports = getDefaultConfig(__dirname);
