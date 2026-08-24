// ==================== 断食目标提醒测试 ====================
// 系统通知接口全部由 mock（行为可控制的替身）代替，测试不需要真的等待 16 小时。

import * as Notifications from 'expo-notifications';
import type {PermissionStatus} from 'expo';

import {
  cancelCycleCompletionNotification,
  isCycleCompletionNotificationScheduled,
  requestCycleNotificationPermission,
  scheduleCycleCompletionNotification,
} from './fastingNotifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: {DEFAULT: 5},
  SchedulableTriggerInputTypes: {DATE: 'date'},
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const notificationsMock = Notifications as jest.Mocked<typeof Notifications>;
const PLANNED_END_AT = 1_787_371_200_000;

beforeEach(() => {
  jest.clearAllMocks();
  notificationsMock.setNotificationChannelAsync.mockResolvedValue(null);
});

test('先建立 Android 通知渠道，再检查已有权限', async () => {
  notificationsMock.getPermissionsAsync.mockResolvedValue({
    canAskAgain: true,
    expires: 'never',
    granted: true,
    status: 'granted' as PermissionStatus,
  });

  await expect(requestCycleNotificationPermission()).resolves.toBe(true);

  expect(
    notificationsMock.setNotificationChannelAsync.mock.invocationCallOrder[0],
  ).toBeLessThan(
    notificationsMock.getPermissionsAsync.mock.invocationCallOrder[0],
  );
  expect(notificationsMock.setNotificationChannelAsync).toHaveBeenCalledWith(
    'fasting-completion',
    {
      name: '目标时间提醒',
      description: '在 NutriTime 设定的目标时间附近提醒你',
      importance: 5,
    },
  );
  expect(notificationsMock.requestPermissionsAsync).not.toHaveBeenCalled();
});

test('系统允许继续询问时请求权限，并返回用户的选择', async () => {
  notificationsMock.getPermissionsAsync.mockResolvedValue({
    canAskAgain: true,
    expires: 'never',
    granted: false,
    status: 'undetermined' as PermissionStatus,
  });
  notificationsMock.requestPermissionsAsync.mockResolvedValue({
    canAskAgain: false,
    expires: 'never',
    granted: false,
    status: 'denied' as PermissionStatus,
  });

  await expect(requestCycleNotificationPermission()).resolves.toBe(false);
  expect(notificationsMock.requestPermissionsAsync).toHaveBeenCalledTimes(1);
});

test('安排 fasting 目标提醒并使用不含健康详情的文案', async () => {
  notificationsMock.scheduleNotificationAsync.mockResolvedValue(
    'notification-1',
  );

  await expect(
    scheduleCycleCompletionNotification(PLANNED_END_AT, 'fasting'),
  ).resolves.toBe('notification-1');

  expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: {
      title: 'NutriTime',
      body: '断食目标已达成。',
      sound: 'default',
    },
    trigger: {
      type: 'date',
      date: PLANNED_END_AT,
      channelId: 'fasting-completion',
    },
  });
});

test('eating 使用同一渠道但显示进食窗口结束文案', async () => {
  notificationsMock.scheduleNotificationAsync.mockResolvedValue(
    'notification-eating',
  );

  await scheduleCycleCompletionNotification(PLANNED_END_AT, 'eating');

  expect(notificationsMock.scheduleNotificationAsync).toHaveBeenCalledWith({
    content: {
      title: 'NutriTime',
      body: '进食窗口已结束。',
      sound: 'default',
    },
    trigger: {
      type: 'date',
      date: PLANNED_END_AT,
      channelId: 'fasting-completion',
    },
  });
});

test('按系统取件号码查询和取消对应提醒', async () => {
  notificationsMock.getAllScheduledNotificationsAsync.mockResolvedValue([
    {identifier: 'notification-1'},
  ] as Notifications.NotificationRequest[]);
  notificationsMock.cancelScheduledNotificationAsync.mockResolvedValue();

  await expect(
    isCycleCompletionNotificationScheduled('notification-1'),
  ).resolves.toBe(true);
  await cancelCycleCompletionNotification('notification-1');

  expect(
    notificationsMock.cancelScheduledNotificationAsync,
  ).toHaveBeenCalledWith('notification-1');
});
