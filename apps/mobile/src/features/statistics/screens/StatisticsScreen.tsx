// ==================== 统计页面 ====================
// 底部导航切到“统计”时显示这个占位页面，目前不会读取数据或绘制图表。

import {Screen} from '../../../shared/components/Screen';
import {WearModuleDebugPanel} from '../components/WearModuleDebugPanel';

// 独立组件让统计功能以后仍留在自己的目录，不会堆进应用入口或导航配置。
export function StatisticsScreen() {
  // __DEV__（只在开发包为真的开关）保证正式用户看不到测试按钮和结果。
  // 该入口只服务阶段 6A；阶段 6B 接入固定 DataItem 发送后应替换或移除。
  return (
    <Screen title="统计">
      {__DEV__ ? <WearModuleDebugPanel /> : null}
    </Screen>
  );
}
