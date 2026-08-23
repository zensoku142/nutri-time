// ==================== Wear 模块开发诊断 ====================
// 这个小区域只验证 TypeScript 能否经过 Expo Module 调到 Kotlin，不参与正式断食业务。

import {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ping} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';

type PingResult =
  | {kind: 'success'; message: string}
  | {kind: 'error'; message: string}
  | null;

const PING_ERROR_MESSAGE =
  '原生模块调用失败，请重新构建并安装 Development Build 后重试。';

function reportPingError(error: unknown) {
  // 页面只显示可操作的短提示；日志也只记录错误种类，不输出堆栈、设备信息或隐私数据。
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error('[NutriTime] wear-module-ping-failed', {errorName});
}

export function WearModuleDebugPanel() {
  const [isCalling, setIsCalling] = useState(false);
  const [result, setResult] = useState<PingResult>(null);
  const isCallingRef = useRef(false);

  const handlePing = async () => {
    // 原生调用尚未返回时禁止再次点击，避免两次日志和页面结果互相覆盖。
    // ref（组件随身的小记事本）会立刻记住状态，比等待页面重新显示 disabled 更早挡住第二次点击。
    if (isCallingRef.current) {
      return;
    }

    isCallingRef.current = true;
    setIsCalling(true);
    setResult(null);

    try {
      const message = await ping();
      setResult({kind: 'success', message});
    } catch (error) {
      reportPingError(error);
      setResult({kind: 'error', message: PING_ERROR_MESSAGE});
    } finally {
      isCallingRef.current = false;
      setIsCalling(false);
    }
  };

  return (
    <View style={styles.panel} accessibilityLabel="Wear 原生模块开发诊断">
      <Text style={styles.description}>
        阶段 6A：主动确认 TypeScript → Kotlin 通信
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isCalling ? '正在测试 Wear 原生模块' : '测试 Wear 原生模块'}
        disabled={isCalling}
        onPress={handlePing}
        style={({pressed}) => [
          styles.button,
          pressed && !isCalling && styles.buttonPressed,
          isCalling && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>
          {isCalling ? '正在调用…' : '测试 Wear 原生模块'}
        </Text>
      </Pressable>
      {result === null ? null : (
        <Text
          accessibilityLiveRegion="polite"
          style={result.kind === 'success' ? styles.success : styles.error}>
          {result.message}
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
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
  success: {
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  error: {
    color: theme.colors.danger,
    textAlign: 'center',
  },
});
