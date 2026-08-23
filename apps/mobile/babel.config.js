// ==================== JavaScript 编译配置 ====================
// Babel（把项目代码转换成手机可执行代码的工具）使用 Expo 官方预设。
module.exports = function (api) {
  // 配置在开发进程中不会变化，缓存后可减少每次重新打包的准备工作。
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
