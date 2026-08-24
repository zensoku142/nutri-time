// ==================== Wear 模块开发诊断 ====================
// 这里只保留 ping（确认 TypeScript 能进入 Kotlin 的敲门测试）；正式断食同步没有手工测试快照入口。

import {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ping} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';

type CallResult =
  | {kind: 'success'; message: string}
  | {kind: 'error'; message: string}
  | null;

const PING_ERROR_MESSAGE =
  '原生模块调用失败，请重新构建并安装 Development Build 后重试。';

function reportWearModuleError(error: unknown) {
  // 页面只显示可操作的短提示；日志也只记录错误种类，不输出堆栈、设备信息或隐私数据。
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error('[NutriTime] wear-module-ping-failed', {errorName});
}

export function WearModuleDebugPanel() {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<CallResult>(null);
  const isPingingRef = useRef(false);

  const handlePing = async () => {
    // 原生调用尚未返回时禁止再次点击，避免两次日志和页面结果互相覆盖。
    // ref（组件随身的小记事本）会立刻记住状态，比等待页面重新显示 disabled 更早挡住第二次点击。
    if (isPingingRef.current) {
      return;
    }

    isPingingRef.current = true;
    setIsPinging(true);
    setPingResult(null);

    try {
      const message = await ping();
      setPingResult({kind: 'success', message});
    } catch (error) {
      reportWearModuleError(error);
      setPingResult({kind: 'error', message: PING_ERROR_MESSAGE});
    } finally {
      isPingingRef.current = false;
      setIsPinging(false);
    }
  };

  return (
    <View style={styles.panel} accessibilityLabel="Wear 原生模块开发诊断">
      <Text style={styles.description}>开发诊断：检查 Wear 原生桥</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPinging ? '正在测试 Wear 原生模块' : '测试 Wear 原生模块'}
        disabled={isPinging}
        onPress={handlePing}
        style={({pressed}) => [
          styles.button,
          pressed && !isPinging && styles.buttonPressed,
          isPinging && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>
          {isPinging ? '正在调用…' : '测试 Wear 原生模块'}
        </Text>
      </Pressable>
      {pingResult === null ? null : (
        <Text
          accessibilityLiveRegion="polite"
          style={pingResult.kind === 'success' ? styles.success : styles.error}>
          {pingResult.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: theme.colors.primaryButtonText,
    fontFamily: theme.fonts.medium,
    fontWeight: '600',
  },
  success: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.medium,
    textAlign: 'center',
    fontWeight: '600',
  },
  error: {
    color: theme.colors.danger,
    fontFamily: theme.fonts.body,
    textAlign: 'center',
  },
});
