// ==================== 底部主导航 ====================
// Tab（点一下就在同一层切换的标签）把禁食和统计两个页面放在应用主界面。
// AppTabBar 只负责外观和手势；页面顺序与显示名称仍以这个文件为准。

import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {FastingScreen} from '../../features/fasting/screens/FastingScreen';
import {StatisticsScreen} from '../../features/statistics/screens/StatisticsScreen';
import {AppTabBar} from './AppTabBar';
import type {MainTabParamList} from './navigationTypes';

// ---------- 页面清单 ----------
// static 配置会在应用启动时一次建立，导航库随后用它保存当前选中的标签。
export const MainTabNavigator = createBottomTabNavigator<MainTabParamList>({
  // 自定义标签栏只改变外观，返回历史和当前页面仍交给导航库统一管理。
  tabBar: props => <AppTabBar {...props} />,
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Fasting: {
      screen: FastingScreen,
      options: {title: '禁食'},
    },
    Statistics: {
      screen: StatisticsScreen,
      options: {title: '统计'},
    },
  },
});
