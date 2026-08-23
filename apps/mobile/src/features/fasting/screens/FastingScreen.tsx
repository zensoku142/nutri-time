// ==================== 禁食页面 ====================
// 页面按已确认的手机设计稿展示 16 小时断食计划，本阶段只处理当前打开期间的界面状态。

import {useState} from 'react';
import {
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

type FastingStatus = 'idle' | 'fasting';

// SVG（放大缩小后仍保持平滑的矢量画布）用同一套正方形坐标绘制圆环。
// 绿色弧线只区分“进行中”的静态视觉，不代表真实进度；阶段 2 前不能接入时钟更新它。
const RING_VIEWBOX_SIZE = 304;
const RING_STROKE_WIDTH = 22;
const RING_CENTER = RING_VIEWBOX_SIZE / 2;
const RING_RADIUS = (RING_VIEWBOX_SIZE - RING_STROKE_WIDTH) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_GAP_LENGTH = RING_CIRCUMFERENCE * 0.06;
const ACTIVE_ARC_LENGTH = RING_CIRCUMFERENCE * 0.22;
const RING_START_ANGLE = -79;
const TRACK_DASH_PATTERN = `${RING_CIRCUMFERENCE - RING_GAP_LENGTH} ${RING_GAP_LENGTH}`;
const ACTIVE_DASH_PATTERN = `${ACTIVE_ARC_LENGTH} ${RING_CIRCUMFERENCE - ACTIVE_ARC_LENGTH}`;
const IDLE_MARKER_X =
  RING_CENTER +
  RING_RADIUS * Math.cos((RING_START_ANGLE * Math.PI) / 180);
const IDLE_MARKER_Y =
  RING_CENTER +
  RING_RADIUS * Math.sin((RING_START_ANGLE * Math.PI) / 180);

export function FastingScreen() {
  // useState（组件自己的小记事本）只保存这次打开页面时的断食状态。
  // 按钮改动后 React 会自动重画文案；关闭或重新加载 App 后小记事本会清空，这是阶段 1 的边界。
  const [fastingStatus, setFastingStatus] = useState<FastingStatus>('idle');

  // useWindowDimensions（系统递来的当前窗口尺寸）会在旋转或分屏时自动更新。
  // 宽和高都使用同一个 ringSize，圆环在不同手机上才不会再次被拉成椭圆。
  const {width: windowWidth} = useWindowDimensions();
  const ringSize = Math.min(
    RING_VIEWBOX_SIZE,
    windowWidth - theme.spacing.xl * 2,
  );

  const isFasting = fastingStatus === 'fasting';
  const statusTitle = isFasting ? '断食进行中' : '16 小时断食';
  const statusDetail = isFasting ? '当前状态' : '准备开始';
  const statusHint = isFasting ? '本次断食已开始' : '计划断食 16 小时';
  const primaryActionLabel = isFasting ? '结束断食' : '开始断食';

  const handlePrimaryAction = () => {
    // 本阶段不读取时钟，也不创建或保存真实断食记录；否则会提前混入阶段 2、3 的行为。
    setFastingStatus(currentStatus =>
      currentStatus === 'idle' ? 'fasting' : 'idle',
    );
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
                  strokeDasharray={ACTIVE_DASH_PATTERN}
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
                16:00:00
              </Text>
              <Text style={styles.statusHint}>{statusHint}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, styles.summaryDivider]}>
              <Text style={styles.summaryLabel}>
                {isFasting ? '状态' : '开始'}
              </Text>
              <Text style={styles.summaryValue}>
                {isFasting ? '已开始' : '尚未开始'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {isFasting ? '计划' : '目标'}
              </Text>
              <Text style={styles.summaryValue}>
                {isFasting ? '16 小时' : '开始后计算'}
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
