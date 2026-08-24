// ==================== 禁食页面 ====================
// 页面沿用已确认的手机设计稿，展示 16 小时断食和随后 8 小时进食窗口，并在启动时恢复当前阶段。

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

import {
  syncCurrentFasting,
  type WearSyncPayload,
} from '../../../../modules/wear-data-layer';
import {theme} from '../../../app/theme';
import {
  CyclePlanEditorModal,
  StartTimeEditorModal,
} from '../components/CycleTimeEditorModals';
import {
  createEatingSession,
  createCyclePlanFromFastingHours,
  createFastingSession,
  DEFAULT_CYCLE_PLAN,
  formatClockTime,
  formatElapsedMs,
  formatRemainingMs,
  getElapsedMs,
  getRemainingMs,
  getSessionDurationMinutes,
  MAX_FASTING_HOURS,
  MIN_FASTING_HOURS,
  updateCycleSessionStart,
} from '../domain/fasting';
import type {ActiveCycleSession, CyclePlan} from '../domain/fasting';
import {
  cancelCycleCompletionNotification,
  isCycleCompletionNotificationScheduled,
  requestCycleNotificationPermission,
  scheduleCycleCompletionNotification,
} from '../notifications/fastingNotifications';
import {
  clearCurrentFastingState,
  readCyclePlan,
  readCurrentFastingState,
  resetCurrentCycleData,
  saveCyclePlan,
  saveCyclePlanAndCurrentState,
  saveCurrentFastingState,
} from '../storage/fastingStorage';
import type {PersistedCycleState} from '../storage/fastingStorage';

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
type ActiveMutation =
  | 'startingFasting'
  | 'startingEating'
  | 'endingEating'
  | 'updatingPlan'
  | 'updatingStart'
  | 'resetting'
  | null;
type TimeEditor = 'plan' | 'start' | null;

const REMINDER_UNAVAILABLE_MESSAGE =
  '当前周期仍在继续，但提醒未启用。请留意计划结束时间。';
const REMINDER_CANCEL_FAILED_MESSAGE =
  '状态已更新，但上一阶段提醒可能仍会出现，请在系统通知中忽略它。';

function reportReminderError(action: string, error: unknown) {
  // 诊断日志只记录失败步骤和错误种类，不记录会话时间或其他可能暴露用户习惯的数据。
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`[NutriTime] ${action}`, {errorName});
}

async function submitCurrentFastingToWear(
  payload: WearSyncPayload,
  urgent: boolean,
) {
  try {
    await syncCurrentFasting(payload, urgent);
  } catch (error) {
    // 手机本地记录已经是最终结果；共享信箱暂时不可用时只留下错误种类，不能撤销用户的开始或结束。
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error('[NutriTime] wear-current-fasting-submit-failed', {
      errorName,
    });
  }
}

async function scheduleAndPersistCompletionReminder(
  session: ActiveCycleSession,
): Promise<string | null> {
  try {
    const permissionGranted = await requestCycleNotificationPermission();

    if (!permissionGranted) {
      return null;
    }
  } catch (error) {
    reportReminderError('notification-permission-check-failed', error);
    return null;
  }

  let notificationId: string;

  try {
    notificationId = await scheduleCycleCompletionNotification(
      session.plannedEndAt,
      session.status,
    );
  } catch (error) {
    reportReminderError('notification-schedule-failed', error);
    return null;
  }

  try {
    await saveCurrentFastingState(session, notificationId);
    return notificationId;
  } catch (error) {
    reportReminderError('notification-id-save-failed', error);

    // 提醒已经交给系统，但取件号码没写进手机小抽屉时，结束断食就再也找不到它。
    // 因此这里马上撤销刚安排的提醒；即使撤销也失败，本地会话仍是主要结果，不能跟着回滚。
    try {
      await cancelCycleCompletionNotification(notificationId);
    } catch (cancelError) {
      reportReminderError(
        'notification-compensation-cancel-failed',
        cancelError,
      );
    }

    return null;
  }
}

type ReminderReplacementResult = {
  notificationId: string | null;
  notice: string | null;
};

async function replaceCompletionReminder(
  previousNotificationId: string | undefined,
  session: ActiveCycleSession,
  now: number,
): Promise<ReminderReplacementResult> {
  let previousReminderCancelFailed = false;

  if (previousNotificationId !== undefined) {
    try {
      await cancelCycleCompletionNotification(previousNotificationId);
    } catch (error) {
      previousReminderCancelFailed = true;
      reportReminderError('notification-cancel-failed', error);
    }
  }

  // 修改后的目标若已经过去，只保留到期页面，不把过去时间再次交给 Android 安排提醒。
  if (session.plannedEndAt <= now) {
    return {
      notificationId: null,
      notice: previousReminderCancelFailed
        ? REMINDER_CANCEL_FAILED_MESSAGE
        : null,
    };
  }

  const notificationId = await scheduleAndPersistCompletionReminder(session);

  if (notificationId === null) {
    return {
      notificationId: null,
      notice: previousReminderCancelFailed
        ? `${REMINDER_CANCEL_FAILED_MESSAGE} ${REMINDER_UNAVAILABLE_MESSAGE}`
        : REMINDER_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    notificationId,
    notice: previousReminderCancelFailed
      ? REMINDER_CANCEL_FAILED_MESSAGE
      : null,
  };
}

export function FastingScreen() {
  // useState（组件自己的小记事本）保存已经确认写入手机的会话和提醒取件号码，以及页面上一次读取到的系统时间。
  const [persistedState, setPersistedState] =
    useState<PersistedCycleState | null>(null);
  const [cyclePlan, setCyclePlan] =
    useState<CyclePlan>(DEFAULT_CYCLE_PLAN);
  const [now, setNow] = useState(0);
  const [recoveryStatus, setRecoveryStatus] =
    useState<RecoveryStatus>('loading');
  const [activeMutation, setActiveMutation] =
    useState<ActiveMutation>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  const [timeEditor, setTimeEditor] = useState<TimeEditor>(null);
  const [draftFastingHours, setDraftFastingHours] = useState(
    DEFAULT_CYCLE_PLAN.fastingMinutes / 60,
  );
  const [draftStartAt, setDraftStartAt] = useState(0);
  const [editorError, setEditorError] = useState<string | null>(null);
  const isMutatingRef = useRef(false);
  const recoveryRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const session = persistedState?.session ?? null;
  const isMutating = activeMutation !== null;
  const isEditorSaving =
    activeMutation === 'updatingPlan' || activeMutation === 'updatingStart';

  const restoreCurrentSession = useCallback(async () => {
    const requestId = recoveryRequestIdRef.current + 1;
    recoveryRequestIdRef.current = requestId;
    setRecoveryStatus('loading');
    setOperationError(null);
    setReminderNotice(null);

    try {
      const [storedState, storedPlan] = await Promise.all([
        readCurrentFastingState(),
        readCyclePlan(),
      ]);

      // 异步竞态是多个等待任务完成顺序不固定。只接受最后一次读取，旧结果就不会覆盖用户刚重试得到的新状态。
      if (requestId !== recoveryRequestIdRef.current) {
        return;
      }

      if (storedState.status === 'invalid' || storedPlan.status === 'invalid') {
        setPersistedState(null);
        setRecoveryStatus('invalid');
        return;
      }

      setCyclePlan(storedPlan.plan);

      if (storedState.status === 'restored') {
        // 恢复时保留原开始和结束时间，只读取此刻时间刷新页面，不能凭空创建一段新断食。
        const restoreNow = Date.now();
        let restoredState = storedState.state;
        setNow(restoreNow);
        setPersistedState(restoredState);

        if (storedState.session.plannedEndAt > restoreNow) {
          let shouldScheduleReminder =
            restoredState.completionNotificationId === undefined;

          if (restoredState.completionNotificationId !== undefined) {
            try {
              shouldScheduleReminder =
                !(await isCycleCompletionNotificationScheduled(
                  restoredState.completionNotificationId,
                ));
            } catch (error) {
              if (requestId !== recoveryRequestIdRef.current) {
                return;
              }

              // 查询失败时无法判断原提醒是否还在；此时不冒险再排一条，避免用户收到两次相同提醒。
              reportReminderError('notification-recovery-check-failed', error);
              setReminderNotice(REMINDER_UNAVAILABLE_MESSAGE);
              shouldScheduleReminder = false;
            }

            if (requestId !== recoveryRequestIdRef.current) {
              return;
            }
          }

          if (shouldScheduleReminder) {
            const notificationId =
              await scheduleAndPersistCompletionReminder(storedState.session);

            if (requestId !== recoveryRequestIdRef.current) {
              return;
            }

            if (notificationId === null) {
              setReminderNotice(REMINDER_UNAVAILABLE_MESSAGE);
            } else {
              restoredState = {
                ...restoredState,
                completionNotificationId: notificationId,
              };
              setPersistedState(restoredState);
            }
          }
        }

        // Wear v1 只认识 idle/fasting。恢复 eating 时提交普通 idle，避免旧手表重开后继续显示上一段断食。
        const wearRestorePayload: WearSyncPayload =
          storedState.session.status === 'fasting'
            ? {
                protocolVersion: 1,
                status: 'fasting',
                sessionId: storedState.session.id,
                startAt: storedState.session.startAt,
                plannedEndAt: storedState.session.plannedEndAt,
                stateChangedAt: storedState.session.startAt,
              }
            : {
                protocolVersion: 1,
                status: 'idle',
                stateChangedAt: storedState.session.startAt,
              };

        // 启动恢复只是把手机已有真相放回共享信箱，不是用户的新操作，因此使用普通 DataItem。
        await submitCurrentFastingToWear(wearRestorePayload, false);

        if (requestId !== recoveryRequestIdRef.current) {
          return;
        }
      } else {
        setPersistedState(null);
      }

      setRecoveryStatus('ready');
    } catch {
      if (requestId === recoveryRequestIdRef.current) {
        setPersistedState(null);
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
    if (session === null || timeEditor !== null) {
      return;
    }

    // interval（每隔一秒提醒一次的系统闹钟）只更新 now，让页面按两个时间戳重新计算；它不是计时真相。
    // 即使应用在后台暂停了这些提醒，回到前台后读取新系统时间也能一次校正，而不会少算后台经过的时间。
    const refreshNow = () => setNow(Date.now());
    // 编辑弹层关闭后先立刻校正一次；弹层打开期间暂停底层圆环重画，滚轮手势才不会被每秒刷新打断。
    refreshNow();
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
  }, [session, timeEditor]);

  // useWindowDimensions（系统递来的当前窗口尺寸）会在旋转或分屏时自动更新。
  // 宽和高都使用同一个 ringSize，圆环在不同手机上才不会再次被拉成椭圆。
  const {width: windowWidth} = useWindowDimensions();
  const ringSize = Math.min(
    RING_VIEWBOX_SIZE,
    windowWidth - theme.spacing.xl * 2,
  );

  // session 中的开始和结束时间戳是唯一真相；已进行、剩余和格式化文字都在本次显示时重新得出，不另存副本。
  const isFasting = session?.status === 'fasting';
  const isEating = session?.status === 'eating';
  const elapsedMs = session === null ? 0 : getElapsedMs(session.startAt, now);
  const remainingMs =
    session === null ? 0 : getRemainingMs(session.plannedEndAt, now);
  const hasReachedStageEnd = session !== null && remainingMs === 0;
  const progress =
    session === null
      ? 0
      : Math.min(
          1,
          elapsedMs / (session.plannedEndAt - session.startAt),
        );
  const progressPercent = Math.floor(progress * 100);
  const fastingHours = cyclePlan.fastingMinutes / 60;
  const eatingHours = cyclePlan.eatingMinutes / 60;
  // 弧长必须严格跟随真实时间百分比；若人为保留最小长度，刚开始就会看起来凭空完成了一截。
  const activeArcLength = RING_TRACK_LENGTH * progress;
  let statusTitle = `${fastingHours}:${eatingHours} 轻断食`;
  let statusDetail = '准备开始';
  let displayedDuration = formatRemainingMs(cyclePlan.fastingMinutes * 60 * 1000);
  let statusHint = `先断食 ${fastingHours} 小时，再进食 ${eatingHours} 小时`;
  let primaryActionLabel = '开始断食';

  if (isFasting) {
    statusTitle = '断食已进行';
    statusDetail = `已完成 ${progressPercent}%`;
    displayedDuration = formatRemainingMs(remainingMs);
    statusHint = `已进行 ${formatElapsedMs(elapsedMs)}`;
    primaryActionLabel = '结束断食';
  }

  if (isEating) {
    statusTitle = '进食窗口';
    statusDetail = `已进行 ${progressPercent}%`;
    displayedDuration = formatRemainingMs(remainingMs);
    statusHint = `已进行 ${formatElapsedMs(elapsedMs)}`;
    primaryActionLabel = '结束进食窗口';
  }

  if (hasReachedStageEnd && isFasting) {
    statusTitle = '断食目标已达成';
    statusHint = `点击结束断食后进入 ${eatingHours} 小时进食窗口`;
  }

  if (hasReachedStageEnd && isEating) {
    statusTitle = '进食窗口已结束';
    statusHint = '点击结束进食窗口后回到空闲状态';
  }

  const handlePrimaryAction = async () => {
    if (recoveryStatus !== 'ready' || isMutatingRef.current) {
      return;
    }

    const currentStatus = persistedState?.session.status ?? 'idle';
    const nextMutation: ActiveMutation =
      currentStatus === 'idle'
        ? 'startingFasting'
        : currentStatus === 'fasting'
          ? 'startingEating'
          : 'endingEating';

    // isMutating 表示按钮处理期间暂时禁止再次点击，避免创建两个会话、两条提醒或让先完成的旧操作覆盖新状态。
    // ref 会立即上锁；即使 React 还没来得及重画禁用按钮，第二次快速点击也会被挡住。
    isMutatingRef.current = true;
    setActiveMutation(nextMutation);
    setOperationError(null);
    setReminderNotice(null);

    try {
      if (persistedState === null) {
        // Date.now() 只在用户点击和系统刷新这类边界读取；核心计算拿到固定参数后不会自己读取时钟。
        const startNow = Date.now();
        const nextSession = createFastingSession(
          startNow,
          cyclePlan.fastingMinutes,
        );

        // 必须先保存再更新页面；若先显示开始但保存失败，用户重开 App 后会丢失这次断食。
        await saveCurrentFastingState(nextSession);

        if (isMountedRef.current) {
          setNow(startNow);
          setPersistedState({storageVersion: 2, session: nextSession});
        }

        // 本地会话是用户点击开始后的主要结果，提醒只是辅助能力；后面的权限或系统通知失败都不能取消断食。
        const notificationId =
          await scheduleAndPersistCompletionReminder(nextSession);

        if (isMountedRef.current) {
          if (notificationId === null) {
            setReminderNotice(REMINDER_UNAVAILABLE_MESSAGE);
          } else {
            setPersistedState({
              storageVersion: 2,
              session: nextSession,
              completionNotificationId: notificationId,
            });
          }
        }

        // 通知是辅助能力；无论权限被拒绝还是安排失败，都要在本地保存成功后提交真实 fasting 快照。
        await submitCurrentFastingToWear(
          {
            protocolVersion: 1,
            status: 'fasting',
            sessionId: nextSession.id,
            startAt: nextSession.startAt,
            plannedEndAt: nextSession.plannedEndAt,
            stateChangedAt: startNow,
          },
          true,
        );
      } else if (persistedState.session.status === 'fasting') {
        const previousNotificationId =
          persistedState.completionNotificationId;
        const eatingStartNow = Date.now();
        const nextSession = createEatingSession(
          eatingStartNow,
          cyclePlan.eatingMinutes,
        );

        // 用户结束断食后，先把新的 eating 会话保存成功；写入失败时页面和旧提醒都继续保持 fasting。
        await saveCurrentFastingState(nextSession);

        if (isMountedRef.current) {
          setNow(eatingStartNow);
          setPersistedState({storageVersion: 2, session: nextSession});
        }

        // eating 已经保存成功，旧提醒取消或新提醒安排失败都不能把手机状态退回 fasting。
        const reminderResult = await replaceCompletionReminder(
          previousNotificationId,
          nextSession,
          eatingStartNow,
        );

        if (isMountedRef.current) {
          if (reminderResult.notificationId !== null) {
            setPersistedState({
              storageVersion: 2,
              session: nextSession,
              completionNotificationId: reminderResult.notificationId,
            });
          }

          setReminderNotice(reminderResult.notice);
        }

        // Wear v1 不能表示 eating；urgent idle 只用于清掉手表上的旧 fasting，不代表手表已经支持进食窗口。
        await submitCurrentFastingToWear(
          {
            protocolVersion: 1,
            status: 'idle',
            stateChangedAt: eatingStartNow,
          },
          true,
        );
      } else {
        // 清除前先拿出提醒取件号码；本地记录删掉后就不能再从手机小抽屉里找回它。
        const notificationId = persistedState.completionNotificationId;

        // 结束进食窗口同样先清手机记录；清除失败时保留 eating，重开 App 也仍能继续显示当前窗口。
        await clearCurrentFastingState();

        if (isMountedRef.current) {
          setPersistedState(null);
        }

        if (notificationId !== undefined) {
          try {
            // 本地清除已经成功，取消提醒失败也不能把用户明确结束的进食窗口恢复回来。
            await cancelCycleCompletionNotification(notificationId);
          } catch (error) {
            reportReminderError('notification-cancel-failed', error);

            if (isMountedRef.current) {
              setReminderNotice(REMINDER_CANCEL_FAILED_MESSAGE);
            }
          }
        }

        // 进入 eating 时已经向 Wear v1 提交过 idle；结束 eating 不重复发送相同状态，避免没有业务变化的额外同步。
      }
    } catch {
      if (isMountedRef.current) {
        setOperationError(
          currentStatus === 'idle'
            ? '断食状态保存失败，本次断食尚未开始，请重试。'
            : currentStatus === 'fasting'
              ? '进食窗口保存失败，本次断食仍在继续，请重试。'
              : '本地状态清除失败，进食窗口仍在继续，请重试。',
        );
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setActiveMutation(null);
      }
    }
  };

  const openPlanEditor = () => {
    if (recoveryStatus !== 'ready' || isMutatingRef.current) {
      return;
    }

    setDraftFastingHours(cyclePlan.fastingMinutes / 60);
    setEditorError(null);
    setTimeEditor('plan');
  };

  const openStartTimeEditor = () => {
    if (
      recoveryStatus !== 'ready' ||
      persistedState === null ||
      isMutatingRef.current
    ) {
      return;
    }

    setDraftStartAt(persistedState.session.startAt);
    setEditorError(null);
    setTimeEditor('start');
  };

  const closeTimeEditor = () => {
    if (!isEditorSaving) {
      setTimeEditor(null);
      setEditorError(null);
    }
  };

  const shiftDraftStartAt = (
    unit: 'day' | 'hour' | 'minute',
    amount: number,
  ) => {
    setDraftStartAt(currentDraft => {
      const date = new Date(currentDraft);

      if (unit === 'day') {
        date.setDate(date.getDate() + amount);
      } else if (unit === 'hour') {
        // 小时滚轮独立循环：23 后面是 00，00 前面是 23，但日期保持不变。
        const nextHour = ((date.getHours() + amount) % 24 + 24) % 24;
        date.setHours(nextHour);
      } else {
        // 分钟滚轮同样独立循环，跨过 59/00 时不能偷偷改变用户已经选好的小时。
        const nextMinute = ((date.getMinutes() + amount) % 60 + 60) % 60;
        date.setMinutes(nextMinute);
      }

      return date.getTime();
    });
  };

  const confirmPlanChange = async () => {
    if (isMutatingRef.current) {
      return;
    }

    const nextPlan = createCyclePlanFromFastingHours(draftFastingHours);
    const currentState = persistedState;
    const actionNow = Date.now();

    isMutatingRef.current = true;
    setActiveMutation('updatingPlan');
    setEditorError(null);
    setReminderNotice(null);

    try {
      if (currentState === null) {
        await saveCyclePlan(nextPlan);

        if (isMountedRef.current) {
          setCyclePlan(nextPlan);
          setTimeEditor(null);
        }

        return;
      }

      const nextSession = updateCycleSessionStart(
        currentState.session,
        currentState.session.startAt,
        getSessionDurationMinutes(nextPlan, currentState.session.status),
      );
      const nextState: PersistedCycleState = {
        storageVersion: 2,
        session: nextSession,
      };

      // 活动阶段的比例和结束时间必须一起保存；任一写入失败都保持页面原状态和旧提醒。
      await saveCyclePlanAndCurrentState(nextPlan, nextState);

      if (isMountedRef.current) {
        setCyclePlan(nextPlan);
        setPersistedState(nextState);
        setNow(actionNow);
      }

      const reminderResult = await replaceCompletionReminder(
        currentState.completionNotificationId,
        nextSession,
        actionNow,
      );

      if (isMountedRef.current) {
        setPersistedState({
          ...nextState,
          ...(reminderResult.notificationId === null
            ? {}
            : {completionNotificationId: reminderResult.notificationId}),
        });
        setReminderNotice(reminderResult.notice);
        setTimeEditor(null);
      }

      if (nextSession.status === 'fasting') {
        await submitCurrentFastingToWear(
          {
            protocolVersion: 1,
            status: 'fasting',
            sessionId: nextSession.id,
            startAt: nextSession.startAt,
            plannedEndAt: nextSession.plannedEndAt,
            stateChangedAt: actionNow,
          },
          true,
        );
      }
    } catch {
      if (isMountedRef.current) {
        setEditorError('周期时长保存失败，原计划仍然有效，请重试。');
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setActiveMutation(null);
      }
    }
  };

  const confirmStartTimeChange = async () => {
    if (isMutatingRef.current || persistedState === null) {
      return;
    }

    const currentState = persistedState;
    const actionNow = Date.now();

    if (draftStartAt > actionNow) {
      setEditorError('开始时间不能晚于当前时间，请重新选择。');
      return;
    }

    const nextSession = updateCycleSessionStart(
      currentState.session,
      draftStartAt,
      getSessionDurationMinutes(cyclePlan, currentState.session.status),
    );
    const nextState: PersistedCycleState = {
      storageVersion: 2,
      session: nextSession,
    };

    isMutatingRef.current = true;
    setActiveMutation('updatingStart');
    setEditorError(null);
    setReminderNotice(null);

    try {
      // 修改开始时间同样先保存；失败时页面、旧提醒和 Wear 快照都维持原值。
      await saveCurrentFastingState(nextSession);

      if (isMountedRef.current) {
        setPersistedState(nextState);
        setNow(actionNow);
      }

      const reminderResult = await replaceCompletionReminder(
        currentState.completionNotificationId,
        nextSession,
        actionNow,
      );

      if (isMountedRef.current) {
        setPersistedState({
          ...nextState,
          ...(reminderResult.notificationId === null
            ? {}
            : {completionNotificationId: reminderResult.notificationId}),
        });
        setReminderNotice(reminderResult.notice);
        setTimeEditor(null);
      }

      if (nextSession.status === 'fasting') {
        await submitCurrentFastingToWear(
          {
            protocolVersion: 1,
            status: 'fasting',
            sessionId: nextSession.id,
            startAt: nextSession.startAt,
            plannedEndAt: nextSession.plannedEndAt,
            stateChangedAt: actionNow,
          },
          true,
        );
      }
    } catch {
      if (isMountedRef.current) {
        setEditorError('开始时间保存失败，原时间仍然有效，请重试。');
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setActiveMutation(null);
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
    setActiveMutation('resetting');
    setOperationError(null);

    try {
      // 损坏数据不会自动消失；只有用户点下重置后才清除，避免把未知旧版本悄悄当成正常 idle。
      await resetCurrentCycleData();

      if (isMountedRef.current) {
        setCyclePlan(DEFAULT_CYCLE_PLAN);
        setRecoveryStatus('ready');
      }
    } catch {
      if (isMountedRef.current) {
        setOperationError('本地状态清除失败，原记录仍保留在手机中，请重试。');
      }
    } finally {
      isMutatingRef.current = false;

      if (isMountedRef.current) {
        setActiveMutation(null);
      }
    }
  };

  if (recoveryStatus !== 'ready') {
    const isLoading = recoveryStatus === 'loading';
    const recoveryTitle =
      recoveryStatus === 'invalid'
        ? '上次周期状态无法恢复'
        : recoveryStatus === 'readError'
          ? '暂时无法读取周期状态'
          : '正在恢复周期状态';
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

  const displayedActionLabel =
    activeMutation === 'startingFasting'
      ? '正在开始断食…'
      : activeMutation === 'startingEating'
        ? '正在进入进食窗口…'
        : activeMutation === 'endingEating'
          ? '正在结束进食窗口…'
          : primaryActionLabel;
  const durationBadgeLabel = `${fastingHours}:${eatingHours} · 修改`;

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
          <Pressable
            accessibilityLabel="修改断食和进食时长"
            accessibilityRole="button"
            disabled={isMutating}
            onPress={openPlanEditor}
            style={({pressed}) => [
              styles.durationBadge,
              pressed && styles.primaryButtonPressed,
              isMutating && styles.primaryButtonDisabled,
            ]}>
            <Text style={styles.durationBadgeText}>{durationBadgeLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.mainContent}>
          <View
            accessibilityLabel={`当前周期状态：${statusTitle}`}
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
              {session !== null ? (
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
              <View style={styles.summaryLabelRow}>
                <Text style={styles.summaryLabel}>
                  {isFasting ? '断食开始' : isEating ? '进食开始' : '开始'}
                </Text>
                {session === null ? null : (
                  <Pressable
                    accessibilityLabel={`修改${isFasting ? '断食' : '进食'}开始时间`}
                    accessibilityRole="button"
                    disabled={isMutating}
                    onPress={openStartTimeEditor}>
                    <Text style={styles.editTimeText}>修改</Text>
                  </Pressable>
                )}
              </View>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.summaryValue}>
                {session === null
                  ? '尚未开始'
                  : formatClockTime(session.startAt, now)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>
                {session === null ? '目标' : '计划结束'}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.summaryValue}>
                {session === null
                  ? '开始后计算'
                  : formatClockTime(session.plannedEndAt, now)}
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
          {reminderNotice === null ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {reminderNotice}
            </Text>
          )}
        </View>
      </ScrollView>
      <CyclePlanEditorModal
        error={editorError}
        fastingHours={draftFastingHours}
        isSaving={isEditorSaving}
        onCancel={closeTimeEditor}
        onConfirm={confirmPlanChange}
        onShiftFastingHours={amount =>
          setDraftFastingHours(current =>
            Math.min(
              MAX_FASTING_HOURS,
              Math.max(MIN_FASTING_HOURS, current + amount),
            ),
          )
        }
        visible={timeEditor === 'plan'}
      />
      <StartTimeEditorModal
        draftStartAt={draftStartAt}
        error={editorError}
        isSaving={isEditorSaving}
        onCancel={closeTimeEditor}
        onConfirm={confirmStartTimeChange}
        onShiftDay={amount => shiftDraftStartAt('day', amount)}
        onShiftHour={amount => shiftDraftStartAt('hour', amount)}
        onShiftMinute={amount => shiftDraftStartAt('minute', amount)}
        stageLabel={isEating ? '进食' : '断食'}
        visible={timeEditor === 'start'}
      />
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
    fontFamily: theme.fonts.medium,
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
    fontFamily: theme.fonts.medium,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  recoveryDetail: {
    maxWidth: 320,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.medium,
    fontSize: 21,
    fontWeight: '700',
  },
  statusDetail: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
  summaryLabelRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  editTimeText: {
    color: theme.colors.fastingActive,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    width: 190,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButtonPressed: {
    opacity: 0.7,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: theme.colors.primaryButtonText,
    fontFamily: theme.fonts.medium,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    maxWidth: 330,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
