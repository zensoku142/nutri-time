// ==================== 禁食页面 ====================
// 页面按已确认的手机设计稿展示 16 小时断食计划，并在启动时恢复手机里保存的当前会话。

import {useCallback, useEffect, useRef, useState} from 'react';
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
import {
  clearCurrentFastingState,
  readCurrentFastingState,
  saveCurrentFastingState,
} from '../storage/fastingStorage';

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

type RecoveryStatus = 'loading' | 'ready' | 'readError' | 'invalid';

export function FastingScreen() {
  // useState（组件自己的小记事本）保存已经确认写入手机的会话，以及页面上一次读取到的系统时间。
  const [session, setSession] = useState<FastingSession | null>(null);
  const [now, setNow] = useState(0);
  const [recoveryStatus, setRecoveryStatus] =
    useState<RecoveryStatus>('loading');
  const [isMutating, setIsMutating] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const isMutatingRef = useRef(false);
  const recoveryRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const restoreCurrentSession = useCallback(async () => {
    const requestId = recoveryRequestIdRef.current + 1;
    recoveryRequestIdRef.current = requestId;
    setRecoveryStatus('loading');
    setOperationError(null);

    try {
      const storedState = await readCurrentFastingState();

      // 异步竞态是多个等待任务完成顺序不固定。只接受最后一次读取，旧结果就不会覆盖用户刚重试得到的新状态。
      if (requestId !== recoveryRequestIdRef.current) {
        return;
      }

      if (storedState.status === 'invalid') {
        setSession(null);
        setRecoveryStatus('invalid');
        return;
      }

      if (storedState.status === 'restored') {
        // 恢复时保留原开始和结束时间，只读取此刻时间刷新页面，不能凭空创建一段新断食。
        setNow(Date.now());
        setSession(storedState.session);
      } else {
        setSession(null);
      }

      setRecoveryStatus('ready');
    } catch {
      if (requestId === recoveryRequestIdRef.current) {
        setSession(null);
        setRecoveryStatus('readError');
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    restoreCurrentSession();

    return () => {
      isMountedRef.current = false;
      recoveryRequestIdRef.current += 1;
    };
  }, [restoreCurrentSession]);

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

  const handlePrimaryAction = async () => {
    if (recoveryStatus !== 'ready' || isMutatingRef.current) {
      return;
    }

    // isMutating 表示按钮处理期间暂时禁止再次点击，避免创建两个会话或让先完成的旧操作覆盖新状态。
    // ref 会立即上锁；即使 React 还没来得及重画禁用按钮，第二次快速点击也会被挡住。
    isMutatingRef.current = true;
    setIsMutating(true);
    setOperationError(null);

    try {
      if (session === null) {
        // Date.now() 只在用户点击和系统刷新这类边界读取；核心计算拿到固定参数后不会自己读取时钟。
        const startNow = Date.now();
        const nextSession = createFastingSession(startNow);

        // 必须先保存再更新页面；若先显示开始但保存失败，用户重开 App 后会丢失这次断食。
        await saveCurrentFastingState(nextSession);

        if (isMountedRef.current) {
          setNow(startNow);
          setSession(nextSession);
        }
      } else {
        // 结束同样先清手机记录；清除失败时保留页面会话，重开 App 也仍能继续这次断食。
        await clearCurrentFastingState();

        if (isMountedRef.current) {
          setSession(null);
        }
      }
    } catch {
      if (isMountedRef.current) {
        setOperationError(
          session === null
            ? '断食状态保存失败，本次断食尚未开始，请重试。'
            : '本地状态清除失败，本次断食仍在继续，请重试。',
        );
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setIsMutating(false);
      }
    }
  };

  const handleRecoveryAction = async () => {
    if (recoveryStatus === 'readError') {
      await restoreCurrentSession();
      return;
    }

    if (recoveryStatus !== 'invalid' || isMutatingRef.current) {
      return;
    }

    isMutatingRef.current = true;
    setIsMutating(true);
    setOperationError(null);

    try {
      // 损坏数据不会自动消失；只有用户点下重置后才清除，避免把未知旧版本悄悄当成正常 idle。
      await clearCurrentFastingState();

      if (isMountedRef.current) {
        setRecoveryStatus('ready');
      }
    } catch {
      if (isMountedRef.current) {
        setOperationError('本地状态清除失败，原记录仍保留在手机中，请重试。');
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setIsMutating(false);
      }
    }
  };

  if (recoveryStatus !== 'ready') {
    const isLoading = recoveryStatus === 'loading';
    const recoveryTitle =
      recoveryStatus === 'invalid'
        ? '上次断食状态无法恢复'
        : recoveryStatus === 'readError'
          ? '暂时无法读取断食状态'
          : '正在恢复断食状态';
    const recoveryDetail =
      recoveryStatus === 'invalid'
        ? '本地记录已损坏或来自不支持的版本。重置前不会覆盖或删除它。'
        : recoveryStatus === 'readError'
          ? '手机暂时没有读到本地记录，请重试。'
          : '请稍候，读取完成前不会显示可操作页面。';
    const recoveryActionLabel =
      recoveryStatus === 'invalid' ? '重置本地状态' : '重试恢复';

    return (
      <SafeAreaView
        edges={['top', 'right', 'left']}
        style={styles.safeArea}>
        <View style={styles.recoveryContainer}>
          <Text accessibilityRole="header" style={styles.brand}>
            NutriTime
          </Text>
          <View style={styles.recoveryMessage}>
            <Text style={styles.recoveryTitle}>{recoveryTitle}</Text>
            <Text style={styles.recoveryDetail}>{recoveryDetail}</Text>
            {operationError === null ? null : (
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {operationError}
              </Text>
            )}
          </View>
          {isLoading ? null : (
            <Pressable
              accessibilityLabel={recoveryActionLabel}
              accessibilityRole="button"
              accessibilityState={{disabled: isMutating}}
              disabled={isMutating}
              onPress={handleRecoveryAction}
              style={({pressed}) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                isMutating && styles.primaryButtonDisabled,
              ]}>
              <Text style={styles.primaryButtonText}>
                {isMutating ? '正在重置…' : recoveryActionLabel}
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const displayedActionLabel = isMutating
    ? isFasting
      ? '正在结束…'
      : '正在开始…'
    : primaryActionLabel;

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
            accessibilityLabel={displayedActionLabel}
            accessibilityRole="button"
            accessibilityState={{disabled: isMutating}}
            disabled={isMutating}
            onPress={handlePrimaryAction}
            style={({pressed}) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isMutating && styles.primaryButtonDisabled,
            ]}>
            <Text style={styles.primaryButtonText}>{displayedActionLabel}</Text>
          </Pressable>
          {operationError === null ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {operationError}
            </Text>
          )}
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
  recoveryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.lg,
    paddingRight: theme.spacing.xl,
    paddingBottom: 132,
    paddingLeft: theme.spacing.xl,
  },
  recoveryMessage: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  recoveryTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  recoveryDetail: {
    maxWidth: 320,
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    maxWidth: 330,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
