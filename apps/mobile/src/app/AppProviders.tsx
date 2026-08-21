// ==================== 全局公共能力 ====================
// Provider（把公共能力交给所有子页面的外壳）会在应用启动时从外到内依次生效。
// 页面放在安全区外壳里面，才能统一避开刘海和底部系统手势区域。

import {SafeAreaProvider} from 'react-native-safe-area-context';

import {RootNavigator} from './navigation/RootNavigator';

// ---------- 应用树装配 ----------
// RootNavigator（管理页面切换的总导航器）放在安全区提供者里面，导航栏才能读取真实底部边距。
export function AppProviders() {
  // SafeAreaProvider（安全区域提供者）会读取刘海、状态栏和底部手势条占用的范围。
  // 它把这些尺寸交给里面的 SafeAreaView 等组件，本身不会直接给页面添加空白。
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
