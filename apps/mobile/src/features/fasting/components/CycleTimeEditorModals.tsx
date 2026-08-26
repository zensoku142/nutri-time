// ==================== 周期时间编辑弹层 ====================
// 两个弹层沿用参考图的底部白色面板：顶部负责取消或确认，中间只展示当前需要修改的时间。

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {theme} from '../../../app/theme';
import {MAX_FASTING_HOURS, MIN_FASTING_HOURS} from '../domain/fasting';

type SharedEditorProps = {
  visible: boolean;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

type CyclePlanEditorModalProps = SharedEditorProps & {
  fastingHours: number;
  onShiftFastingHours: (amount: number) => void;
};

type StartTimeEditorModalProps = SharedEditorProps & {
  stageLabel: string;
  draftStartAt: number;
  onShiftDay: (amount: number) => void;
  onShiftHour: (amount: number) => void;
  onShiftMinute: (amount: number) => void;
};

type EndTimeEditorModalProps = SharedEditorProps & {
  stageLabel: string;
  draftEndAt: number;
  onShiftDay: (amount: number) => void;
  onShiftHour: (amount: number) => void;
  onShiftMinute: (amount: number) => void;
};

type StageTimeEditorModalProps = SharedEditorProps & {
  stageLabel: string;
  timeKind: 'start' | 'end';
  draftTimeAt: number;
  onShiftDay: (amount: number) => void;
  onShiftHour: (amount: number) => void;
  onShiftMinute: (amount: number) => void;
};

type EditorSheetProps = SharedEditorProps & {
  title: string;
  children: ReactNode;
};

type WheelUnit = 'day' | 'hour' | 'minute';

type WheelPickerItem = {
  accessibilityLabel: string;
  key: number | string;
  offset: number;
  value: string;
};

type WheelPickerProps = {
  accessibilityLabel: string;
  disabled: boolean;
  isDateColumn?: boolean;
  items: readonly WheelPickerItem[];
  recenterAfterSelect?: boolean;
  selectedIndex: number;
  variant?: 'time' | 'ratio';
  visible: boolean;
  onSelect: (item: WheelPickerItem) => void;
};

// 参考应用的 WheelView（松手后自动对齐一行的滚轮）每行高 56 dp，中间显示 5 行中的第 3 行。
// 小时和分钟两侧各准备 30 个值，用户一次可以快速滑过多项；开始日期只保留用户确认的前天、昨天和今天。
const WHEEL_ITEM_HEIGHT = 56;
const WHEEL_VISIBLE_ITEM_COUNT = 5;
const TIME_WHEEL_CENTER_INDEX = 30;
const WHEEL_SIDE_PADDING =
  ((WHEEL_VISIBLE_ITEM_COUNT - 1) / 2) * WHEEL_ITEM_HEIGHT;
const START_DATE_DAY_OFFSETS = [-2, -1, 0] as const;
const END_DATE_DAY_SHIFTS = [-2, -1, 0, 1, 2] as const;
const END_DATE_CENTER_INDEX = 2;
const TIME_WHEEL_OFFSETS = Array.from(
  {length: TIME_WHEEL_CENTER_INDEX * 2 + 1},
  (_, index) => index - TIME_WHEEL_CENTER_INDEX,
);
const RATIO_WHEEL_ITEM_HEIGHT = 82;
const RATIO_WHEEL_VISIBLE_ITEM_COUNT = 3;
const RATIO_WHEEL_SIDE_PADDING =
  ((RATIO_WHEEL_VISIBLE_ITEM_COUNT - 1) / 2) * RATIO_WHEEL_ITEM_HEIGHT;

function EditorSheet({
  visible,
  title,
  isSaving,
  error,
  onCancel,
  onConfirm,
  children,
}: EditorSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="关闭时间编辑"
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="取消修改"
              disabled={isSaving}
              onPress={onCancel}
              style={styles.headerAction}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="确认修改"
              disabled={isSaving}
              onPress={onConfirm}
              style={[styles.confirmButton, isSaving && styles.disabled]}>
              <Text style={styles.confirmText}>
                {isSaving ? '保存中' : '确定'}
              </Text>
            </Pressable>
          </View>
          {children}
          {error === null ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {error}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function CyclePlanEditorModal({
  visible,
  fastingHours,
  isSaving,
  error,
  onShiftFastingHours,
  onCancel,
  onConfirm,
}: CyclePlanEditorModalProps) {
  // 每格只保存断食小时数，进食时间统一用 24 减去它；这样向一侧增加时，另一侧一定同步减少。
  const ratioItems = useMemo(
    () =>
      Array.from(
        {length: MAX_FASTING_HOURS - MIN_FASTING_HOURS + 1},
        (_, index) => {
          const itemFastingHours = MIN_FASTING_HOURS + index;
          const offset = itemFastingHours - fastingHours;

          return {
            accessibilityLabel:
              offset === 0
                ? `当前周期 ${itemFastingHours}:${24 - itemFastingHours}`
                : `${offset < 0 ? '减少' : '增加'}断食 ${Math.abs(offset)} 小时`,
            key: itemFastingHours,
            offset,
            value: `${itemFastingHours}:${24 - itemFastingHours}`,
          };
        },
      ),
    [fastingHours],
  );

  return (
    <EditorSheet
      error={error}
      isSaving={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="修改周期时长"
      visible={visible}>
      <View style={styles.planContent}>
        <Text style={styles.ratioWheelLabel}>断食：进食</Text>
        <View style={styles.ratioWheelFrame}>
          <View
            pointerEvents="none"
            style={styles.ratioWheelSelectionBar}
          />
          <WheelPicker
            accessibilityLabel="断食进食比例滚轮"
            disabled={isSaving}
            items={ratioItems}
            onSelect={item => onShiftFastingHours(item.offset)}
            selectedIndex={fastingHours - MIN_FASTING_HOURS}
            variant="ratio"
            visible={visible}
          />
        </View>
      </View>
    </EditorSheet>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function getCalendarDayNumber(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDifference(timestamp: number, reference: number): number {
  return Math.round(
    (getCalendarDayNumber(timestamp) - getCalendarDayNumber(reference)) /
      (24 * 60 * 60 * 1000),
  );
}

function formatRelativeDate(timestamp: number, now: number): string {
  const dayDifference = getCalendarDayDifference(timestamp, now);

  if (dayDifference === -2) {
    return '前天';
  }

  if (dayDifference === -1) {
    return '昨天';
  }

  if (dayDifference === 0) {
    return '今天';
  }

  return formatDate(timestamp);
}

function formatHour(timestamp: number): string {
  return String(new Date(timestamp).getHours()).padStart(2, '0');
}

function formatMinute(timestamp: number): string {
  return String(new Date(timestamp).getMinutes()).padStart(2, '0');
}

function shiftTimestamp(
  timestamp: number,
  unit: WheelUnit,
  amount: number,
): number {
  const date = new Date(timestamp);

  if (unit === 'day') {
    date.setDate(date.getDate() + amount);
  } else if (unit === 'hour') {
    date.setHours(date.getHours() + amount);
  } else {
    date.setMinutes(date.getMinutes() + amount);
  }

  return date.getTime();
}

function formatWheelValue(
  timestamp: number,
  unit: WheelUnit,
  now: number,
): string {
  if (unit === 'day') {
    return formatRelativeDate(timestamp, now);
  }

  if (unit === 'hour') {
    return formatHour(timestamp);
  }

  return formatMinute(timestamp);
}

function getWheelItemAccessibilityLabel(
  unit: WheelUnit,
  offset: number,
  value: string,
): string {
  const unitLabel = unit === 'day' ? '天' : unit === 'hour' ? '小时' : '分钟';

  if (offset === 0) {
    return `${unit === 'day' ? '当前日期' : `当前${unitLabel}`} ${value}`;
  }

  const direction = offset < 0 ? '前' : '后';
  const amount = Math.abs(offset);
  const amountLabel = amount === 1 ? '一' : String(amount);
  return `选择${direction}${amountLabel}${unitLabel}`;
}

function createStartDateWheelData(
  draftStartAt: number,
  relativeDateReference: number,
): {items: WheelPickerItem[]; selectedIndex: number} {
  const selectedDayOffset = getCalendarDayDifference(
    draftStartAt,
    relativeDateReference,
  );
  const selectedIndex = Math.max(
    0,
    Math.min(START_DATE_DAY_OFFSETS.length - 1, selectedDayOffset + 2),
  );
  const items = START_DATE_DAY_OFFSETS.map(dayOffset => {
    const timestamp = shiftTimestamp(
      relativeDateReference,
      'day',
      dayOffset,
    );
    const offset = dayOffset - selectedDayOffset;
    const value = formatRelativeDate(timestamp, relativeDateReference);

    return {
      accessibilityLabel: getWheelItemAccessibilityLabel(
        'day',
        offset,
        value,
      ),
      key: dayOffset,
      offset,
      value,
    };
  });

  return {items, selectedIndex};
}

function createEndDateWheelData(
  draftEndAt: number,
  relativeDateReference: number,
): {items: WheelPickerItem[]; selectedIndex: number} {
  // 结束时间可能跨过午夜，也可能在阶段到期后补改；始终把当前草稿放在中间，用户就能连续向前或向后选择日期。
  const items = END_DATE_DAY_SHIFTS.map(offset => {
    const timestamp = shiftTimestamp(draftEndAt, 'day', offset);
    const value = formatRelativeDate(timestamp, relativeDateReference);

    return {
      accessibilityLabel: getWheelItemAccessibilityLabel(
        'day',
        offset,
        value,
      ),
      key: offset,
      offset,
      value,
    };
  });

  return {items, selectedIndex: END_DATE_CENTER_INDEX};
}

function createTimeWheelItems(
  draftStartAt: number,
  unit: 'hour' | 'minute',
  relativeDateReference: number,
): WheelPickerItem[] {
  return TIME_WHEEL_OFFSETS.map(offset => {
    const timestamp = shiftTimestamp(draftStartAt, unit, offset);
    const value = formatWheelValue(
      timestamp,
      unit,
      relativeDateReference,
    );

    return {
      accessibilityLabel: getWheelItemAccessibilityLabel(
        unit,
        offset,
        value,
      ),
      key: offset,
      offset,
      value,
    };
  });
}

function WheelPicker({
  accessibilityLabel,
  disabled,
  isDateColumn = false,
  items,
  recenterAfterSelect = false,
  selectedIndex,
  variant = 'time',
  visible,
  onSelect,
}: WheelPickerProps) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUserInteractionRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
  const itemHeight =
    variant === 'ratio' ? RATIO_WHEEL_ITEM_HEIGHT : WHEEL_ITEM_HEIGHT;
  const sidePadding =
    variant === 'ratio' ? RATIO_WHEEL_SIDE_PADDING : WHEEL_SIDE_PADDING;
  const centerOffset = selectedIndex * itemHeight;
  const scrollPosition = useRef(new Animated.Value(centerOffset)).current;
  const handleAnimatedScroll = useMemo(
    () =>
      Animated.event(
        [{nativeEvent: {contentOffset: {y: scrollPosition}}}],
        {useNativeDriver: true},
      ),
    [scrollPosition],
  );

  const resetToCenter = useCallback(() => {
    scrollPosition.setValue(centerOffset);
    scrollViewRef.current?.scrollTo({
      animated: false,
      x: 0,
      y: centerOffset,
    });
  }, [centerOffset, scrollPosition]);

  const commitOffset = useCallback(
    (scrollOffset: number) => {
      const itemIndex = Math.max(
        0,
        Math.min(
          items.length - 1,
          Math.round(scrollOffset / itemHeight),
        ),
      );
      hasUserInteractionRef.current = false;

      const didSelectNewItem =
        itemIndex !== selectedIndex && items[itemIndex] !== undefined;

      if (didSelectNewItem) {
        onSelect(items[itemIndex]);
      }

      // 无限时间列需要回到中间缓冲区；有真实上下限的比例列留在新位置，避免先退回旧值再跳回来。
      if (recenterAfterSelect || !didSelectNewItem) {
        resetToCenter();
      }
    },
    [
      itemHeight,
      items,
      onSelect,
      recenterAfterSelect,
      resetToCenter,
      selectedIndex,
    ],
  );

  useEffect(() => {
    if (visible) {
      resetToCenter();
    }
  }, [resetToCenter, selectedIndex, visible]);

  useEffect(
    () => () => {
      if (scrollEndTimerRef.current !== null) {
        clearTimeout(scrollEndTimerRef.current);
      }
    },
    [],
  );

  const handleScrollBeginDrag = () => {
    hasUserInteractionRef.current = true;
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!hasUserInteractionRef.current) {
      return;
    }

    const scrollOffset = event.nativeEvent.contentOffset.y;

    if (scrollEndTimerRef.current !== null) {
      clearTimeout(scrollEndTimerRef.current);
    }

    // 慢慢拖动时系统可能不会进入惯性滚动；短暂等待能区分两种情况，避免同一次手势提交两遍。
    scrollEndTimerRef.current = setTimeout(() => {
      scrollEndTimerRef.current = null;

      if (!isMomentumScrollingRef.current) {
        commitOffset(scrollOffset);
      }
    }, 80);
  };

  const handleMomentumScrollBegin = () => {
    if (!hasUserInteractionRef.current) {
      return;
    }

    isMomentumScrollingRef.current = true;

    if (scrollEndTimerRef.current !== null) {
      clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!hasUserInteractionRef.current) {
      resetToCenter();
      return;
    }

    isMomentumScrollingRef.current = false;
    commitOffset(event.nativeEvent.contentOffset.y);
  };

  return (
    <Animated.ScrollView
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      bounces={false}
      contentContainerStyle={{paddingVertical: sidePadding}}
      contentOffset={{x: 0, y: centerOffset}}
      // 比例项字号更大，使用 normal 惯性让它自然滑停；时间列保持快速吸附，避免一次跨过太多值。
      decelerationRate={variant === 'ratio' ? 'normal' : 'fast'}
      nestedScrollEnabled
      onContentSizeChange={visible ? resetToCenter : undefined}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onScroll={handleAnimatedScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      overScrollMode="never"
      ref={scrollViewRef}
      removeClippedSubviews
      scrollEnabled={!disabled}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={itemHeight}
      style={[
        styles.wheelColumn,
        isDateColumn && styles.wheelDateColumn,
        variant === 'ratio' && styles.ratioWheel,
      ]}>
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const scale = scrollPosition.interpolate({
          inputRange: [
            (index - 1) * itemHeight,
            index * itemHeight,
            (index + 1) * itemHeight,
          ],
          outputRange:
            variant === 'ratio' ? [0.52, 1, 0.52] : [0.9, 1, 0.9],
          extrapolate: 'clamp',
        });
        const opacity = scrollPosition.interpolate({
          inputRange: [
            (index - 1) * itemHeight,
            index * itemHeight,
            (index + 1) * itemHeight,
          ],
          outputRange: variant === 'ratio' ? [0.38, 1, 0.38] : [1, 1, 1],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={item.key}
            style={{
              height: itemHeight,
              opacity,
              transform: [{scale}],
            }}>
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{
                disabled,
                selected: isSelected,
              }}
              disabled={disabled}
              onPress={() => {
                const didSelectNewItem = index !== selectedIndex;

                if (didSelectNewItem) {
                  onSelect(item);
                }

                if (recenterAfterSelect || !didSelectNewItem) {
                  resetToCenter();
                }
              }}
              style={styles.wheelItem}>
              <Text
                style={
                  variant === 'ratio'
                    ? styles.ratioWheelText
                    : isSelected
                      ? styles.wheelSelectedText
                      : styles.wheelAdjacentText
                }>
                {item.value}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

function StageTimeEditorModal({
  visible,
  stageLabel,
  timeKind,
  draftTimeAt,
  isSaving,
  error,
  onShiftDay,
  onShiftHour,
  onShiftMinute,
  onCancel,
  onConfirm,
}: StageTimeEditorModalProps) {
  const [relativeDateReference, setRelativeDateReference] = useState(Date.now);

  useEffect(() => {
    if (visible) {
      // 弹层每次打开时重新确认“今天”，长时间放在后台后也不会沿用旧日期。
      setRelativeDateReference(Date.now());
    }
  }, [visible]);

  const dateWheel = useMemo(
    () =>
      timeKind === 'start'
        ? createStartDateWheelData(draftTimeAt, relativeDateReference)
        : createEndDateWheelData(draftTimeAt, relativeDateReference),
    [draftTimeAt, relativeDateReference, timeKind],
  );
  const hourItems = useMemo(
    () => createTimeWheelItems(draftTimeAt, 'hour', relativeDateReference),
    [draftTimeAt, relativeDateReference],
  );
  const minuteItems = useMemo(
    () => createTimeWheelItems(draftTimeAt, 'minute', relativeDateReference),
    [draftTimeAt, relativeDateReference],
  );
  const timeLabel = timeKind === 'start' ? '开始' : '结束';

  return (
    <EditorSheet
      error={error}
      isSaving={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={`修改${stageLabel}${timeLabel}时间`}
      visible={visible}>
      <View style={styles.startTimeContent}>
        <View style={styles.pickerRow}>
          <View pointerEvents="none" style={styles.pickerSelectionBar} />
          <WheelPicker
            accessibilityLabel="日期滚轮"
            disabled={isSaving}
            isDateColumn
            items={dateWheel.items}
            onSelect={item => onShiftDay(item.offset)}
            recenterAfterSelect={timeKind === 'end'}
            selectedIndex={dateWheel.selectedIndex}
            visible={visible}
          />
          <WheelPicker
            accessibilityLabel="小时滚轮"
            disabled={isSaving}
            items={hourItems}
            onSelect={item => onShiftHour(item.offset)}
            recenterAfterSelect
            selectedIndex={TIME_WHEEL_CENTER_INDEX}
            visible={visible}
          />
          <Text importantForAccessibility="no" style={styles.pickerColon}>
            :
          </Text>
          <WheelPicker
            accessibilityLabel="分钟滚轮"
            disabled={isSaving}
            items={minuteItems}
            onSelect={item => onShiftMinute(item.offset)}
            recenterAfterSelect
            selectedIndex={TIME_WHEEL_CENTER_INDEX}
            visible={visible}
          />
        </View>
        <Text style={styles.helperText}>
          {timeKind === 'start'
            ? '上下滑动选择，开始时间不能晚于现在'
            : '上下滑动选择，结束时间必须晚于开始时间'}
        </Text>
      </View>
    </EditorSheet>
  );
}

export function StartTimeEditorModal({
  draftStartAt,
  ...props
}: StartTimeEditorModalProps) {
  return (
    <StageTimeEditorModal
      {...props}
      draftTimeAt={draftStartAt}
      timeKind="start"
    />
  );
}

export function EndTimeEditorModal({
  draftEndAt,
  ...props
}: EndTimeEditorModalProps) {
  return (
    <StageTimeEditorModal
      {...props}
      draftTimeAt={draftEndAt}
      timeKind="end"
    />
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.backdrop,
  },
  sheet: {
    minHeight: 410,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.surface,
    paddingTop: theme.spacing.sm,
    paddingRight: theme.spacing.xl,
    paddingBottom: 36,
    paddingLeft: theme.spacing.xl,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAction: {
    minWidth: 76,
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    minWidth: 76,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
  },
  confirmText: {
    color: theme.colors.primaryButtonText,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  planContent: {
    width: '100%',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  ratioWheelLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.medium,
    fontSize: 16,
  },
  ratioWheelFrame: {
    position: 'relative',
    width: '100%',
    height: RATIO_WHEEL_ITEM_HEIGHT * RATIO_WHEEL_VISIBLE_ITEM_COUNT,
  },
  ratioWheelSelectionBar: {
    position: 'absolute',
    top: RATIO_WHEEL_SIDE_PADDING,
    right: 0,
    left: 0,
    height: RATIO_WHEEL_ITEM_HEIGHT,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.pickerHighlight,
  },
  startTimeContent: {
    gap: theme.spacing.sm,
  },
  pickerRow: {
    position: 'relative',
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEM_COUNT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerSelectionBar: {
    position: 'absolute',
    top: WHEEL_SIDE_PADDING,
    right: 0,
    left: 0,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.pickerHighlight,
  },
  wheelColumn: {
    flex: 1,
    height: '100%',
    zIndex: 1,
  },
  wheelDateColumn: {
    flex: 1.25,
  },
  ratioWheel: {
    width: '100%',
  },
  wheelItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelAdjacentText: {
    color: theme.colors.navigationInactive,
    fontFamily: theme.fonts.number,
    fontSize: 18,
  },
  wheelSelectedText: {
    color: theme.colors.fastingActive,
    fontFamily: theme.fonts.number,
    fontSize: 20,
  },
  ratioWheelText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.displayAmount,
    fontSize: 54,
    lineHeight: 64,
  },
  pickerColon: {
    width: 24,
    zIndex: 2,
    color: theme.colors.fastingActive,
    fontFamily: theme.fonts.number,
    fontSize: 20,
    textAlign: 'center',
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
