// ==================== 周期目标提醒 ====================
// Expo Notifications（把提醒交给 Android 系统安排的官方工具）集中在这里调用，页面只关心成功或失败。

import * as Notifications from 'expo-notifications';

import {
  startCountdown,
  stopCountdown,
} from '../../../../modules/fasting-notification';
import type {ActiveCycleSession} from '../domain/fasting';

type CycleStage = ActiveCycleSession['status'];

// 沿用原渠道 ID，系统升级后不会留下两套同类渠道或让用户重新配置声音。
const FASTING_COMPLETION_CHANNEL_ID = 'fasting-completion';

// App 正在前台时 Android 也要显示到期提醒；后台和关闭页面后的展示仍由系统接管。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------- 权限与渠道 ----------
async function configureCycleNotificationChannel(): Promise<void> {
  // 通知渠道是 Android 管理同类通知声音和重要程度的分类；先建渠道，Android 13 才能正确显示权限询问。
  await Notifications.setNotificationChannelAsync(
    FASTING_COMPLETION_CHANNEL_ID,
    {
      name: '目标时间提醒',
      description: '在 NutriTime 设定的目标时间附近提醒你',
      importance: Notifications.AndroidImportance.DEFAULT,
    },
  );
}

export async function requestCycleNotificationPermission(): Promise<boolean> {
  await configureCycleNotificationChannel();

  const currentPermission = await Notifications.getPermissionsAsync();

  if (currentPermission.granted) {
    return true;
  }

  if (!currentPermission.canAskAgain) {
    return false;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return requestedPermission.granted;
}

// ---------- 安排与取消 ----------
export async function scheduleCycleCompletionNotification(
  plannedEndAt: number,
  stage: CycleStage,
): Promise<string> {
  // 调用方通常已在请求权限前建好渠道，这里再次确认是为了让单独调用也不会落入系统的模糊默认分类。
  await configureCycleNotificationChannel();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'NutriTime',
      body:
        stage === 'fasting' ? '断食目标已达成。' : '进食窗口已结束。',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plannedEndAt,
      channelId: FASTING_COMPLETION_CHANNEL_ID,
    },
  });
}

export async function isCycleCompletionNotificationScheduled(
  notificationId: string,
): Promise<boolean> {
  const scheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  return scheduledNotifications.some(
    notification => notification.identifier === notificationId,
  );
}

export async function cancelCycleCompletionNotification(
  notificationId: string,
): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// ---------- 通知栏常驻倒计时 ----------
export async function startCycleCountdownNotification(
  plannedEndAt: number,
  stage: CycleStage,
): Promise<void> {
  // 这里只传不会变化的目标时间；通知栏里的秒数由 Android 自己刷新，应用无需每秒重发通知。
  await startCountdown(plannedEndAt, stage);
}

export async function stopCycleCountdownNotification(): Promise<void> {
  await stopCountdown();
}
