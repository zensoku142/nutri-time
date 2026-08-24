// ==================== 周期时间编辑弹层 ====================
// 两个弹层沿用参考图的底部白色面板：顶部负责取消或确认，中间只展示当前需要修改的时间。

import type {ReactNode} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {theme} from '../../../app/theme';

type SharedEditorProps = {
  visible: boolean;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

type CyclePlanEditorModalProps = SharedEditorProps & {
  fastingHours: number;
  eatingHours: number;
  canDecreaseFasting: boolean;
  canIncreaseFasting: boolean;
  onDecreaseFasting: () => void;
  onIncreaseFasting: () => void;
};

type StartTimeEditorModalProps = SharedEditorProps & {
  stageLabel: string;
  draftStartAt: number;
  onShiftDay: (amount: number) => void;
  onShiftHour: (amount: number) => void;
  onShiftMinute: (amount: number) => void;
};

type EditorSheetProps = SharedEditorProps & {
  title: string;
  children: ReactNode;
};

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
  eatingHours,
  canDecreaseFasting,
  canIncreaseFasting,
  isSaving,
  error,
  onDecreaseFasting,
  onIncreaseFasting,
  onCancel,
  onConfirm,
}: CyclePlanEditorModalProps) {
  return (
    <EditorSheet
      error={error}
      isSaving={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="修改周期时长"
      visible={visible}>
      <View style={styles.planContent}>
        <Text style={styles.ratioText}>
          {fastingHours}:{eatingHours}
        </Text>
        <Text style={styles.helperText}>
          两段合计 24 小时，默认 16:8
        </Text>
        <View style={styles.planRow}>
          <View style={styles.planCard}>
            <Text style={styles.planLabel}>断食</Text>
            <Text style={styles.planValue}>{fastingHours} 小时</Text>
          </View>
          <View style={styles.planCard}>
            <Text style={styles.planLabel}>进食</Text>
            <Text style={styles.planValue}>{eatingHours} 小时</Text>
          </View>
        </View>
        <View style={styles.planActions}>
          <Pressable
            accessibilityLabel="减少断食 1 小时"
            disabled={!canDecreaseFasting || isSaving}
            onPress={onDecreaseFasting}
            style={[
              styles.adjustButton,
              (!canDecreaseFasting || isSaving) && styles.disabled,
            ]}>
            <Text style={styles.adjustButtonText}>断食减少 1 小时</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="增加断食 1 小时"
            disabled={!canIncreaseFasting || isSaving}
            onPress={onIncreaseFasting}
            style={[
              styles.adjustButton,
              (!canIncreaseFasting || isSaving) && styles.disabled,
            ]}>
            <Text style={styles.adjustButtonText}>断食增加 1 小时</Text>
          </Pressable>
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

function formatHour(timestamp: number): string {
  return String(new Date(timestamp).getHours()).padStart(2, '0');
}

function formatMinute(timestamp: number): string {
  return String(new Date(timestamp).getMinutes()).padStart(2, '0');
}

type PickerColumnProps = {
  label: string;
  previousLabel: string;
  selectedLabel: string;
  nextLabel: string;
  previousAccessibilityLabel: string;
  nextAccessibilityLabel: string;
  onPrevious: () => void;
  onNext: () => void;
};

function PickerColumn({
  label,
  previousLabel,
  selectedLabel,
  nextLabel,
  previousAccessibilityLabel,
  nextAccessibilityLabel,
  onPrevious,
  onNext,
}: PickerColumnProps) {
  return (
    <View style={styles.pickerColumn}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={previousAccessibilityLabel}
        onPress={onPrevious}
        style={styles.pickerOption}>
        <Text style={styles.pickerAdjacent}>{previousLabel}</Text>
      </Pressable>
      <View style={styles.pickerSelected}>
        <Text style={styles.pickerSelectedText}>{selectedLabel}</Text>
      </View>
      <Pressable
        accessibilityLabel={nextAccessibilityLabel}
        onPress={onNext}
        style={styles.pickerOption}>
        <Text style={styles.pickerAdjacent}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

export function StartTimeEditorModal({
  visible,
  stageLabel,
  draftStartAt,
  isSaving,
  error,
  onShiftDay,
  onShiftHour,
  onShiftMinute,
  onCancel,
  onConfirm,
}: StartTimeEditorModalProps) {
  const previousDay = new Date(draftStartAt);
  previousDay.setDate(previousDay.getDate() - 1);
  const nextDay = new Date(draftStartAt);
  nextDay.setDate(nextDay.getDate() + 1);
  const previousHour = (new Date(draftStartAt).getHours() + 23) % 24;
  const nextHour = (new Date(draftStartAt).getHours() + 1) % 24;
  const previousMinute = (new Date(draftStartAt).getMinutes() + 59) % 60;
  const nextMinute = (new Date(draftStartAt).getMinutes() + 1) % 60;

  return (
    <EditorSheet
      error={error}
      isSaving={isSaving}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={`修改${stageLabel}开始时间`}
      visible={visible}>
      <View style={styles.startTimeContent}>
        <Text style={styles.helperText}>开始时间不能晚于现在</Text>
        <View style={styles.pickerRow}>
          <PickerColumn
            label="日期"
            nextAccessibilityLabel="选择后一天"
            nextLabel={formatDate(nextDay.getTime())}
            onNext={() => onShiftDay(1)}
            onPrevious={() => onShiftDay(-1)}
            previousAccessibilityLabel="选择前一天"
            previousLabel={formatDate(previousDay.getTime())}
            selectedLabel={formatDate(draftStartAt)}
          />
          <PickerColumn
            label="小时"
            nextAccessibilityLabel="选择后一小时"
            nextLabel={String(nextHour).padStart(2, '0')}
            onNext={() => onShiftHour(1)}
            onPrevious={() => onShiftHour(-1)}
            previousAccessibilityLabel="选择前一小时"
            previousLabel={String(previousHour).padStart(2, '0')}
            selectedLabel={formatHour(draftStartAt)}
          />
          <PickerColumn
            label="分钟"
            nextAccessibilityLabel="选择后一分钟"
            nextLabel={String(nextMinute).padStart(2, '0')}
            onNext={() => onShiftMinute(1)}
            onPrevious={() => onShiftMinute(-1)}
            previousAccessibilityLabel="选择前一分钟"
            previousLabel={String(previousMinute).padStart(2, '0')}
            selectedLabel={formatMinute(draftStartAt)}
          />
        </View>
      </View>
    </EditorSheet>
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
    backgroundColor: 'rgba(31, 36, 35, 0.58)',
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
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    minWidth: 76,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.fastingActive,
  },
  confirmText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  planContent: {
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  ratioText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.displayAmount,
    fontSize: 54,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  planRow: {
    width: '100%',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  planCard: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.lg,
  },
  planLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  planValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  planActions: {
    width: '100%',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  adjustButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
  },
  adjustButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  startTimeContent: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pickerLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  pickerOption: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAdjacent: {
    color: theme.colors.navigationInactive,
    fontFamily: theme.fonts.number,
    fontSize: 18,
  },
  pickerSelected: {
    width: '100%',
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.buttonBackground,
  },
  pickerSelectedText: {
    color: theme.colors.fastingActive,
    fontFamily: theme.fonts.number,
    fontSize: 24,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
