// ==================== Wear 模块开发诊断 ====================
// 这是阶段 6B 的开发诊断入口，只验证原生桥和固定 DataItem 链路，不参与正式断食业务。
// 阶段 6C 接入真实状态后应移除或缩减，正式用户不应看到这里的按钮和结果。

import {useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {ping, sendTestSnapshot} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';

type CallResult =
  | {kind: 'success'; message: string}
  | {kind: 'error'; message: string}
  | null;

const PING_ERROR_MESSAGE =
  '原生模块调用失败，请重新构建并安装 Development Build 后重试。';
const SNAPSHOT_ERROR_MESSAGE =
  '测试快照提交失败，请查看 Metro 与 Logcat 后重试。';

function reportWearModuleError(action: 'ping' | 'test-snapshot', error: unknown) {
  // 页面只显示可操作的短提示；日志也只记录错误种类，不输出堆栈、设备信息或隐私数据。
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[NutriTime] wear-module-${action}-failed`, {errorName});
}

export function WearModuleDebugPanel() {
  const [isPinging, setIsPinging] = useState(false);
  const [isSendingSnapshot, setIsSendingSnapshot] = useState(false);
  const [pingResult, setPingResult] = useState<CallResult>(null);
  const [snapshotResult, setSnapshotResult] = useState<CallResult>(null);
  const isPingingRef = useRef(false);
  const isSendingSnapshotRef = useRef(false);

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
      reportWearModuleError('ping', error);
      setPingResult({kind: 'error', message: PING_ERROR_MESSAGE});
    } finally {
      isPingingRef.current = false;
      setIsPinging(false);
    }
  };

  const handleSendTestSnapshot = async () => {
    // 发送尚未完成时挡住快速重复点击，保证一次主动操作只提交一份固定测试快照。
    if (isSendingSnapshotRef.current) {
      return;
    }

    isSendingSnapshotRef.current = true;
    setIsSendingSnapshot(true);
    setSnapshotResult(null);

    try {
      await sendTestSnapshot();
      // Kotlin 只确认已把快照交给 Data Layer；这里不能写成“手表同步成功”。
      setSnapshotResult({kind: 'success', message: '已提交同步'});
    } catch (error) {
      reportWearModuleError('test-snapshot', error);
      setSnapshotResult({kind: 'error', message: SNAPSHOT_ERROR_MESSAGE});
    } finally {
      isSendingSnapshotRef.current = false;
      setIsSendingSnapshot(false);
    }
  };

  return (
    <View style={styles.panel} accessibilityLabel="Wear 原生模块开发诊断">
      <Text style={styles.description}>
        阶段 6B：分层检查原生桥与固定 DataItem
      </Text>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isSendingSnapshot ? '正在发送测试快照' : '发送测试快照'
        }
        disabled={isSendingSnapshot}
        onPress={handleSendTestSnapshot}
        style={({pressed}) => [
          styles.button,
          pressed && !isSendingSnapshot && styles.buttonPressed,
          isSendingSnapshot && styles.buttonDisabled,
        ]}>
        <Text style={styles.buttonText}>
          {isSendingSnapshot ? '正在提交…' : '发送测试快照'}
        </Text>
      </Pressable>
      {snapshotResult === null ? null : (
        <Text
          accessibilityLiveRegion="polite"
          style={snapshotResult.kind === 'success' ? styles.success : styles.error}>
          {snapshotResult.message}
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
