// ==================== 应用入口 ====================
// App 是 React Native 打开后最先显示的组件。
// 它只负责接上全局公共能力，页面和导航仍分别放在 src 目录中。

import {AppProviders} from './src/app/AppProviders';

// AppProviders（全局公共能力的总开关）会继续准备安全区、请求缓存和页面导航。
function App() {
  return <AppProviders />;
}

export default App;
