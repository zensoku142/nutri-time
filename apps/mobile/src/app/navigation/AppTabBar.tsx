// ==================== NutriTime 底部导航适配 ====================
// 通用组件只负责胶囊外观和交互；这里把 NutriTime 的路由图标与主题颜色交给它。

import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import type {ImageSourcePropType} from 'react-native';

import {
  FloatingCapsuleTabBar,
  type FloatingCapsuleTabBarColors,
} from '../../shared/components/FloatingCapsuleTabBar';
import {theme} from '../theme';
import type {MainTabParamList} from './navigationTypes';

const tabIcons: Record<keyof MainTabParamList, ImageSourcePropType> = {
  Fasting: require('./assets/tab-home.webp'),
  Statistics: require('./assets/tab-statistics.webp'),
};

const tabBarColors: FloatingCapsuleTabBarColors = {
  active: theme.colors.navigationActive,
  inactive: theme.colors.navigationInactive,
  capsuleBackground: theme.colors.buttonBackground,
  capsuleBorder: theme.colors.navigationBorder,
  indicatorBackground: theme.colors.navigationActiveBackground,
  maskTransparent: theme.colors.navigationMaskTransparent,
  maskStart: theme.colors.navigationMaskStart,
  maskEnd: theme.colors.navigationMaskEnd,
  shadow: theme.colors.text,
};

export function AppTabBar(props: BottomTabBarProps) {
  return (
    <FloatingCapsuleTabBar
      {...props}
      colors={tabBarColors}
      icons={tabIcons}
    />
  );
}

// 继续从旧入口导出计算函数，避免现有测试和调用方因组件抽取而同步改路径。
export {
  calculateDragPosition,
  getNearestTabIndex,
} from '../../shared/components/FloatingCapsuleTabBar';
