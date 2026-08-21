// ==================== 页面公共外壳 ====================
// Screen 让不同页面共用安全区、背景和内容间距，但不处理任何禁食或统计业务。
// children（页面塞进外壳里的内容）可以是标题下面的按钮、列表或提示文字。

import type {PropsWithChildren} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {theme} from '../../app/theme';

type ScreenProps = PropsWithChildren<{
  // title 是页面中央展示给用户的中文名称。
  title: string;
  // 只有悬浮底部导航下的可滚动页面需要开启；普通堆栈页面仍保留底部安全区保护。
  extendUnderBottomBar?: boolean;
}>;

// ---------- 安全区布局 ----------
// SafeAreaView（避开刘海和系统手势区的容器）默认保护左右与底部。
// 首页开启 extendUnderBottomBar 后只保护左右，让列表能铺到悬浮导航和底部手势条后面。
export function Screen({
  title,
  children,
  extendUnderBottomBar = false,
}: ScreenProps) {
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={
        extendUnderBottomBar
          ? ['right', 'left']
          : ['right', 'bottom', 'left']
      }>
      <View
        style={[
          styles.content,
          extendUnderBottomBar && styles.contentUnderBottomBar,
        ]}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    // 页面画布保持统一底色；悬浮导航的透明程度由 AppTabBar 自己控制。
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.xl,
  },
  contentUnderBottomBar: {
    // 首页列表需要一直铺到屏幕最底部；若保留这里的 padding，只会透出一块纯背景色。
    paddingBottom: 0,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.spacing.xl,
    fontWeight: '600',
  },
});
