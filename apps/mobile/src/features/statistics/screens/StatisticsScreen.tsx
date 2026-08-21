// ==================== 统计页面 ====================
// 底部导航切到“统计”时显示这个占位页面，目前不会读取数据或绘制图表。

import {Screen} from '../../../shared/components/Screen';

// 独立组件让统计功能以后仍留在自己的目录，不会堆进应用入口或导航配置。
export function StatisticsScreen() {
  return <Screen title="统计" />;
}
