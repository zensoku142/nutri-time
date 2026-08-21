// ==================== 根页面导航 ====================
// 当前应用只有底部两个主页面，因此直接把主标签导航交给 React Navigation 显示。
// 等真正出现详情页或弹窗时再增加 Stack，避免现在保留没有用途的页面层级。

import {createStaticNavigation} from '@react-navigation/native';

import {MainTabNavigator} from './MainTabNavigator';

const Navigation = createStaticNavigation(MainTabNavigator);

// AppProviders 会显示这个入口，Navigation 会自行记住访问顺序并处理系统返回操作。
export function RootNavigator() {
  return <Navigation />;
}
