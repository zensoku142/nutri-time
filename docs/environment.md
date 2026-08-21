# 开发环境

## 手机端当前基线

- React Native：0.86.0
- React：19.2.3
- 包管理器：pnpm 11.19.0
- Android compileSdk / targetSdk：36
- Android minSdk：24
- Kotlin：2.1.20
- 手机工程位置：`apps/mobile`

当前手机工程是 React Native CLI 迁移基线，尚未完成计划阶段 0B 的 Expo Development Build 与 CNG 转换。

## 常用命令

在仓库根目录进入手机工程：

```powershell
Set-Location apps/mobile
pnpm install
pnpm start
```

在另一个终端运行 Android：

```powershell
Set-Location apps/mobile
pnpm android
```

验证：

```powershell
Set-Location apps/mobile
pnpm lint
node_modules/.bin/tsc.cmd --noEmit
node_modules/.bin/jest.cmd --runInBand
Set-Location android
./gradlew.bat app:assembleDebug
```

## 后续补充

阶段 0B 需要记录实际 Node、JDK、Android SDK 路径、`adb devices` 输出、模拟器或真机 serial，以及 Expo Development Build 的可复现命令。
