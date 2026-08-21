// ==================== 原生注册入口 ====================
// Android 或 iOS 启动后会先执行这个文件，再按 app.json 中的名称找到 App 组件。

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// registerComponent（登记应用入口）必须保留，否则原生窗口不知道应显示哪一个 React 页面。
AppRegistry.registerComponent(appName, () => App);
