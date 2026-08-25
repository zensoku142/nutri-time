// ==================== 自动更新入口 ====================
// 正式版应用打开时在后台检查一次 GitHub Release；有新版本才显示提示。
// Development Build 使用不同证书，所以开发调试时不会下载无法覆盖安装的正式 APK。

import {useEffect} from 'react';
import {Alert} from 'react-native';

import type {AvailableAppUpdate} from '../domain/appUpdate';
import {
  checkForAvailableUpdate,
  downloadAndOpenAppUpdate,
} from '../services/appUpdateService';

function showUpdatePrompt(update: AvailableAppUpdate): void {
  const message = update.notes || '新版本已经准备好，可以立即下载并安装。';

  Alert.alert(`发现新版本 ${update.versionName}`, message, [
    {text: '稍后再说', style: 'cancel'},
    {
      text: '立即更新',
      onPress: () => {
        downloadAndOpenAppUpdate(update).catch(() => {
          Alert.alert(
            '更新下载失败',
            '请确认网络连接和“安装未知应用”权限后再试。',
          );
        });
      },
    },
  ]);
}

export function AppUpdateBootstrap() {
  useEffect(() => {
    if (__DEV__) {
      return;
    }

    let isMounted = true;

    checkForAvailableUpdate()
      .then(update => {
        // 网络返回时页面可能已经关闭；这时不再弹窗，避免已销毁页面继续操作手机界面。
        if (isMounted && update) {
          showUpdatePrompt(update);
        }
      })
      .catch(() => {
        // 自动检查保持安静，离线或 GitHub 暂时不可用时不能挡住用户进入计时页面。
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
