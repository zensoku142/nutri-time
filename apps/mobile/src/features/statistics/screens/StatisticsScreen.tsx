// ==================== 统计页面 ====================
// 底部导航切到“统计”时显示这个占位页面，目前不会读取数据或绘制图表。

import {Screen} from '../../../shared/components/Screen';
import {WearModuleDebugPanel} from '../components/WearModuleDebugPanel';

// 独立组件让统计功能以后仍留在自己的目录，不会堆进应用入口或导航配置。
export function StatisticsScreen() {
  // __DEV__（只在开发包为真的开关）保证正式用户看不到测试按钮和结果。
  // 阶段 6C 已删除固定快照按钮，这里只保留不会修改业务数据的原生桥 ping 诊断。
  return (
    <Screen title="统计">
      {__DEV__ ? <WearModuleDebugPanel /> : null}
    </Screen>
  );
}
