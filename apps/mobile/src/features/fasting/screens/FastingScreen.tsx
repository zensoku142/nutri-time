// ==================== 禁食页面 ====================
// 页面按已确认的手机设计稿展示 16 小时断食计划，会话仍只保存在本次打开期间的内存中。

import {useEffect, useState} from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Circle} from 'react-native-svg';

import {theme} from '../../../app/theme';
import {
  createFastingSession,
  DEFAULT_FASTING_MINUTES,
  formatClockTime,
  formatElapsedMs,
  formatRemainingMs,
  getElapsedMs,
  getRemainingMs,
} from '../domain/fasting';
import type {FastingSession} from '../domain/fasting';

// SVG（放大缩小后仍保持平滑的矢量画布）用同一套正方形坐标绘制圆环。
// 绿色弧线根据时间戳算出的进度增长，页面刷新再慢也不会改变真实进度。
const RING_VIEWBOX_SIZE = 304;
const RING_STROKE_WIDTH = 22;
const RING_CENTER = RING_VIEWBOX_SIZE / 2;
const RING_RADIUS = (RING_VIEWBOX_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_GAP_LENGTH = RING_CIRCUMFERENCE * 0.06;
const RING_TRACK_LENGTH = RING_CIRCUMFERENCE - RING_GAP_LENGTH;
const RING_START_ANGLE = -79;
const TRACK_DASH_PATTERN = `${RING_CIRCUMFERENCE - RING_GAP_LENGTH} ${RING_GAP_LENGTH}`;
const IDLE_MARKER_X =
  RING_CENTER +
  RING_RADIUS * Math.cos((RING_START_ANGLE * Math.PI) / 180);
const IDLE_MARKER_Y =
  RING_CENTER +
  RING_RADIUS * Math.sin((RING_START_ANGLE * Math.PI) / 180);

export function FastingScreen() {
  // useState（组件自己的小记事本）只保存当前会话和页面上一次读取到的系统时间。
  // 重新加载 App 后小记事本会清空，这是阶段 2 允许的结果；本地恢复要到阶段 3 才实现。
  const [session, setSession] = useState<FastingSession | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (session === null) {
      return;
    }

    // interval（每隔一秒提醒一次的系统闹钟）只更新 now，让页面按两个时间戳重新计算；它不是计时真相。
    // 即使应用在后台暂停了这些提醒，回到前台后读取新系统时间也能一次校正，而不会少算后台经过的时间。
    const refreshNow = () => setNow(Date.now());
    const intervalId = setInterval(refreshNow, 1000);
    // AppState（应用当前在前台还是后台的状态）变回 active 时会立刻刷新，不必等下一秒的 interval。
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState === 'active') {
          refreshNow();
        }
      },
    );

    return () => {
      // 结束断食、替换会话或离开页面时必须清掉旧 interval，否则重复开始后会有多个闹钟一起刷新，让页面额外耗电。
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [session]);

  // useWindowDimensions（系统递来的当前窗口尺寸）会在旋转或分屏时自动更新。
  // 宽和高都使用同一个 ringSize，圆环在不同手机上才不会再次被拉成椭圆。
  const {width: windowWidth} = useWindowDimensions();
  const ringSize = Math.min(
    RING_VIEWBOX_SIZE,
    windowWidth - theme.spacing.xl * 2,
  );

  // session 中的开始和结束时间戳是唯一真相；已进行、剩余和格式化文字都在本次显示时重新得出，不另存副本。
  const isFasting = session !== null;
  const elapsedMs = session === null ? 0 : getElapsedMs(session.startAt, now);
  const remainingMs =
    session === null ? 0 : getRemainingMs(session.plannedEndAt, now);
  const hasReachedGoal = session !== null && remainingMs === 0;
  const progress =
    session === null
      ? 0
      : Math.min(
          1,
          elapsedMs / (session.plannedEndAt - session.startAt),
        );
  const progressPercent = Math.floor(progress * 100);
  // 弧长必须严格跟随真实时间百分比；若人为保留最小长度，刚开始就会看起来凭空完成了一截。
  const activeArcLength = RING_TRACK_LENGTH * progress;
  let statusTitle = '16 小时断食';
  let statusDetail = '准备开始';
  let displayedDuration = formatRemainingMs(
    DEFAULT_FASTING_MINUTES * 60 * 1000,
  );
  let statusHint = '计划断食 16 小时';
  let primaryActionLabel = '开始断食';

  if (isFasting) {
    statusTitle = '断食进行中';
    statusDetail = `已完成 ${progressPercent}%`;
    displayedDuration = formatElapsedMs(elapsedMs);
    statusHint = `还剩 ${formatRemainingMs(remainingMs)}`;
    primaryActionLabel = '结束断食';
  }

  if (hasReachedGoal) {
    statusTitle = '目标已达成';
    statusHint = '你完成了本次断食';
    primaryActionLabel = '结束本次断食';
  }

  const handlePrimaryAction = () => {
    if (session !== null) {
      setSession(null);
      return;
    }

    // Date.now() 只在用户点击和系统刷新这类边界读取；核心计算拿到固定参数后不会自己读取时钟。
    const startNow = Date.now();
    setNow(startNow);
    setSession(createFastingSession(startNow));
  };

  return (
    <SafeAreaView
      edges={['top', 'right', 'left']}
      style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.brand}>
            NutriTime
          </Text>
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>16 小时</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
          <View
            accessibilityLabel={`当前断食状态：${statusTitle}`}
            accessible
            style={[styles.statusRing, {width: ringSize, height: ringSize}]}>
            <Svg
              height="100%"
              style={styles.ringGraphic}
              viewBox={`0 0 ${RING_VIEWBOX_SIZE} ${RING_VIEWBOX_SIZE}`}
              width="100%">
              <Circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                fill="none"
                origin={`${RING_CENTER}, ${RING_CENTER}`}
                r={RING_RADIUS}
                rotation={RING_START_ANGLE}
                stroke={theme.colors.border}
                strokeDasharray={TRACK_DASH_PATTERN}
                strokeLinecap="round"
                strokeWidth={RING_STROKE_WIDTH}
              />
              {isFasting ? (
                <Circle
                  cx={RING_CENTER}
                  cy={RING_CENTER}
                  fill="none"
                  origin={`${RING_CENTER}, ${RING_CENTER}`}
                  r={RING_RADIUS}
                  rotation={RING_START_ANGLE}
                  stroke={theme.colors.fastingActive}
                  strokeDasharray={`${activeArcLength} ${
                    RING_CIRCUMFERENCE - activeArcLength
                  }`}
                  strokeLinecap="round"
                  strokeWidth={RING_STROKE_WIDTH}
                />
              ) : (
                <Circle
                  cx={IDLE_MARKER_X}
                  cy={IDLE_MARKER_Y}
                  fill={theme.colors.fastingActive}
                  r={RING_STROKE_WIDTH / 2}
                />
              )}
            </Svg>

            <View style={styles.ringContent}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.statusDetail}>{statusDetail}</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.durationTime}>
                {displayedDuration}
              </Text>
              <Text style={styles.statusHint}>{statusHint}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, styles.summaryDivider]}>
              <Text style={styles.summaryLabel}>
                {isFasting ? '已开始' : '开始'}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.summaryValue}>
                {session === null
                  ? '尚未开始'
                  : formatClockTime(session.startAt)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {isFasting ? '计划结束' : '目标'}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.summaryValue}>
                {session === null
                  ? '开始后计算'
                  : formatClockTime(session.plannedEndAt)}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel={primaryActionLabel}
            accessibilityRole="button"
            onPress={handlePrimaryAction}
            style={({pressed}) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}>
            <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    // 底部导航浮在页面上方；多留出这段空间，矮屏滚动到底时按钮也不会被胶囊遮住。
    paddingBottom: 132,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  durationBadge: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.navigationActiveBackground,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  durationBadgeText: {
    color: theme.colors.navigationActive,
    fontFamily: theme.fonts.number,
    fontSize: 15,
  },
  mainContent: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.xl,
    paddingTop: 36,
  },
  statusRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGraphic: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  ringContent: {
    width: '72%',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusTitle: {
    color: theme.colors.navigationActive,
    fontSize: 21,
    fontWeight: '700',
  },
  statusDetail: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  durationTime: {
    width: '100%',
    color: theme.colors.text,
    fontFamily: theme.fonts.displayAmount,
    fontSize: 54,
    lineHeight: 62,
    textAlign: 'center',
  },
  statusHint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  summaryRow: {
    width: '100%',
    maxWidth: 330,
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  summaryDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.border,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    width: 190,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButtonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
