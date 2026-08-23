// ==================== Expo 应用入口 ====================
// Development Build（包含项目原生能力的开发版应用）启动后会先执行这个文件。

import {registerRootComponent} from 'expo';
import App from './App';

// registerRootComponent（登记首页）同时照顾 Expo 和原生启动流程，避免两种入口名称不一致。
registerRootComponent(App);
