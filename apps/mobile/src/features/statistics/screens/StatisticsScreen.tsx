// ==================== 断食统计页面 ====================
// 底部导航切到“统计”时读取手机本地完成记录，并按参考图显示汇总、上次窗口和最近七天三个模块。

import {useCallback, useMemo, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {theme} from '../../../app/theme';
import {
  formatClockTime,
  type CompletedFastingSession,
} from '../../fasting/domain/fasting';
import {readFastingHistory} from '../../fasting/storage/fastingStorage';
import {
  getCompletedDurationMs,
  getDurationParts,
  getFastingStatistics,
  type FastingStatistics,
  type RecentFastingDay,
} from '../domain/statistics';

type LoadStatus = 'loading' | 'ready' | 'error' | 'invalid';

const CHART_MAX_HOURS = 24;
const CHART_HEIGHT = 112;

type SummaryMetricProps = {
  label: string;
  value: number;
  unit: string;
};

function SummaryMetric({label, value, unit}: SummaryMetricProps) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>
        <Text style={styles.summaryNumber}>{value}</Text>
        {unit}
      </Text>
    </View>
  );
}

function SummaryCard({statistics}: {statistics: FastingStatistics}) {
  return (
    <View accessibilityLabel="断食汇总" style={[styles.card, styles.summaryCard]}>
      <SummaryMetric
        label="累计次数"
        unit="次"
        value={statistics.totalCount}
      />
      <SummaryMetric
        label="最长断食"
        unit="小时"
        value={statistics.longestDurationHours}
      />
      <SummaryMetric
        label="连续断食"
        unit="天"
        value={statistics.consecutiveDays}
      />
    </View>
  );
}

function EmptyLastSession({loadStatus}: {loadStatus: LoadStatus}) {
  const title =
    loadStatus === 'loading'
      ? '正在读取断食记录…'
      : loadStatus === 'invalid'
        ? '断食记录暂时无法恢复'
        : loadStatus === 'error'
          ? '断食记录读取失败'
          : '还没有完成的断食';
  const detail =
    loadStatus === 'ready'
      ? '结束一次断食后，这里会显示实际时长和起止时间。'
      : loadStatus === 'loading'
        ? '请稍候，读取完成前不会把结果当成零记录。'
        : '原记录不会被自动删除，请稍后重新打开统计页。';

  return (
    <View accessibilityLiveRegion="polite" style={styles.emptySession}>
      <Text style={styles.emptySessionTitle}>{title}</Text>
      <Text style={styles.emptySessionDetail}>{detail}</Text>
    </View>
  );
}

type LastSessionCardProps = {
  latestSession: CompletedFastingSession | null;
  loadStatus: LoadStatus;
  now: number;
};

function LastSessionCard({
  latestSession,
  loadStatus,
  now,
}: LastSessionCardProps) {
  const duration =
    latestSession === null
      ? null
      : getDurationParts(getCompletedDurationMs(latestSession));
  const goalAchieved =
    latestSession !== null &&
    latestSession.completedAt >= latestSession.plannedEndAt;

  return (
    <View accessibilityLabel="上次断食窗口" style={styles.card}>
      <Text style={styles.cardTitle}>上次断食窗口</Text>
      {latestSession === null || duration === null ? (
        <EmptyLastSession loadStatus={loadStatus} />
      ) : (
        <View style={styles.lastSessionPanel}>
          <Text style={styles.durationSummary}>
            <Text style={styles.durationNumber}>{duration.hours}</Text> 小时{'  '}
            <Text style={styles.durationNumber}>{duration.minutes}</Text> 分钟
          </Text>
          <View style={styles.timeRange}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>开始时间</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.timeValue}>
                {formatClockTime(latestSession.startAt, now)}
              </Text>
            </View>
            <Text accessibilityElementsHidden style={styles.timeConnector}>
              至
            </Text>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>结束时间</Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.timeValue}>
                {formatClockTime(latestSession.completedAt, now)}
              </Text>
            </View>
          </View>
          <View style={styles.goalStatus}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: goalAchieved
                    ? theme.colors.primary
                    : theme.colors.statisticsMissed,
                },
              ]}
            />
            <Text style={styles.goalStatusText}>
              {goalAchieved ? '本次断食目标已达成' : '本次断食提前结束'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ChartLegend() {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendItem}>
        <View
          style={[
            styles.legendDot,
            {backgroundColor: theme.colors.primary},
          ]}
        />
        <Text style={styles.legendText}>目标达成</Text>
      </View>
      <View style={styles.legendItem}>
        <View
          style={[
            styles.legendDot,
            {backgroundColor: theme.colors.statisticsMissed},
          ]}
        />
        <Text style={styles.legendText}>目标未达成</Text>
      </View>
    </View>
  );
}

type ChartBarProps = {
  day: RecentFastingDay;
  isSelected: boolean;
  onPress: () => void;
};

function ChartBar({day, isSelected, onPress}: ChartBarProps) {
  const durationHours = day.durationMs / (60 * 60 * 1000);
  const fillHeight = Math.min(
    CHART_HEIGHT,
    (durationHours / CHART_MAX_HOURS) * CHART_HEIGHT,
  );
  const displayedHours = `${durationHours.toFixed(1)}h`;

  return (
    <Pressable
      accessibilityLabel={`${day.label}，断食 ${displayedHours}`}
      accessibilityRole="button"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={styles.chartColumn}>
      <View style={styles.tooltipSlot}>
        {isSelected ? (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{displayedHours}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.barTrack}>
        {day.session === null ? null : (
          <View
            style={[
              styles.barFill,
              {
                height: Math.max(3, fillHeight),
                backgroundColor: day.goalAchieved
                  ? theme.colors.primary
                  : theme.colors.statisticsMissed,
              },
            ]}
          />
        )}
      </View>
      <Text style={styles.dayLabel}>{day.label}</Text>
    </Pressable>
  );
}

type RecentFastingCardProps = {
  days: RecentFastingDay[];
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
};

function RecentFastingCard({
  days,
  selectedDayIndex,
  onSelectDay,
}: RecentFastingCardProps) {
  return (
    <View accessibilityLabel="最近的断食" style={[styles.card, styles.chartCard]}>
      <Text style={styles.cardTitle}>最近的断食</Text>
      <ChartLegend />
      <View style={styles.chartRow}>
        <View style={styles.chartColumns}>
          {days.map((day, index) => (
            <ChartBar
              day={day}
              isSelected={selectedDayIndex === index}
              key={day.dayStartAt}
              onPress={() => onSelectDay(index)}
            />
          ))}
        </View>
        <View accessibilityElementsHidden style={styles.axisLabels}>
          <Text style={styles.axisLabel}>24</Text>
          <Text style={styles.axisLabel}>20</Text>
          <Text style={styles.axisLabel}>16</Text>
          <Text style={styles.axisLabel}>12</Text>
          <Text style={styles.axisLabel}>8</Text>
          <Text style={styles.axisLabel}>4</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>
      </View>
    </View>
  );
}

export function StatisticsScreen() {
  const [sessions, setSessions] = useState<CompletedFastingSession[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [referenceNow, setReferenceNow] = useState(() => Date.now());
  const [selectedDayIndex, setSelectedDayIndex] = useState(6);

  useFocusEffect(
    useCallback(() => {
      let isCurrentFocus = true;
      const nextReferenceNow = Date.now();

      setLoadStatus('loading');
      setReferenceNow(nextReferenceNow);

      readFastingHistory()
        .then(result => {
          if (!isCurrentFocus) {
            return;
          }

          if (result.status === 'invalid') {
            // 未知版本或损坏记录继续留在手机里；统计页只说明问题，不能把它假装成“零记录”。
            setSessions([]);
            setLoadStatus('invalid');
            return;
          }

          setSessions(result.sessions);
          setSelectedDayIndex(6);
          setLoadStatus('ready');
        })
        .catch(() => {
          if (isCurrentFocus) {
            setSessions([]);
            setLoadStatus('error');
          }
        });

      // 用户很快切走时，旧读取结果不能回来覆盖下一次打开统计页得到的新记录。
      return () => {
        isCurrentFocus = false;
      };
    }, []),
  );

  const statistics = useMemo(
    () => getFastingStatistics(sessions, referenceNow),
    [referenceNow, sessions],
  );

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.pageTitle}>
          断食统计
        </Text>
        <SummaryCard statistics={statistics} />
        <LastSessionCard
          latestSession={statistics.latestSession}
          loadStatus={loadStatus}
          now={referenceNow}
        />
        <RecentFastingCard
          days={statistics.recentDays}
          onSelectDay={setSelectedDayIndex}
          selectedDayIndex={selectedDayIndex}
        />
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
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    // 悬浮底部导航会盖在列表上方；额外空间保证最近七天模块可以完整滚出导航区域。
    paddingBottom: 132,
  },
  pageTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: 20,
  },
  summaryCard: {
    minHeight: 116,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  summaryValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  summaryNumber: {
    fontFamily: theme.fonts.number,
    fontSize: 31,
    fontWeight: '700',
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 20,
    fontWeight: '700',
  },
  emptySession: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.statisticsTrack,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.xl,
  },
  emptySessionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySessionDetail: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  lastSessionPanel: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.statisticsTrack,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  durationSummary: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 16,
  },
  durationNumber: {
    fontFamily: theme.fonts.number,
    fontSize: 32,
    fontWeight: '700',
  },
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeBlock: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  timeLabel: {
    color: theme.colors.navigationActive,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  timeValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    fontWeight: '600',
  },
  timeConnector: {
    color: theme.colors.navigationActive,
    fontFamily: theme.fonts.medium,
    fontSize: 13,
  },
  goalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  goalStatusText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  chartCard: {
    minHeight: 290,
  },
  legendRow: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  chartRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  chartColumns: {
    flex: 1,
    flexDirection: 'row',
    height: CHART_HEIGHT + 60,
  },
  chartColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  tooltipSlot: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tooltip: {
    minWidth: 44,
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  tooltipText: {
    color: theme.colors.primaryButtonText,
    fontFamily: theme.fonts.number,
    fontSize: 12,
  },
  barTrack: {
    width: 11,
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: theme.colors.statisticsTrack,
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
  },
  dayLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    marginTop: theme.spacing.sm,
  },
  axisLabels: {
    width: 24,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    marginTop: 34,
    marginLeft: theme.spacing.sm,
  },
  axisLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textAlign: 'right',
  },
});
