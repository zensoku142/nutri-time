// ==================== 自动测试配置 ====================
// Jest（自动运行代码检查场景的工具）使用 React Native 官方测试环境。
// pnpm 把依赖放在 .pnpm 子目录，而导航和 React Native 依赖发布的是需要 Babel 转换的源码；
// 下方白名单确保这些包会被转换，其余 node_modules 仍跳过以保持测试启动速度。
module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(?:react-native|react-native-screens|react-native-safe-area-context|@react-native\\+[^@]+|@react-navigation\\+[^@]+|react-freeze|use-latest-callback)@)',
    'node_modules/(?!\\.pnpm/|((jest-)?react-native|react-native-screens|react-native-safe-area-context|@react-native(-community)?|@react-navigation|react-freeze|use-latest-callback)/)',
  ],
};
