# FloatingCapsuleTabBar

`FloatingCapsuleTabBar` 是项目内可复用的 React Navigation 自定义底部导航组件，提供悬浮胶囊、点击与横向拖动、弹簧吸附、安全区和底部渐隐。

组件不知道任何 NutriTime 业务。调用方负责提供：

- React Navigation 的 `BottomTabBarProps`；
- 以路由名为键的图片图标；
- 激活、未激活、胶囊、指示块、遮罩和阴影颜色；
- 可选胶囊宽度，默认是屏幕宽度的 `70%`。

```tsx
<FloatingCapsuleTabBar
  {...props}
  icons={{
    Home: require('./tab-home.webp'),
    Statistics: require('./tab-statistics.webp'),
  }}
  colors={{
    active: '#FF786A',
    inactive: '#969696',
    capsuleBackground: 'rgba(255, 255, 255, 0.82)',
    capsuleBorder: 'rgba(255, 255, 255, 0.94)',
    indicatorBackground: 'rgba(255, 120, 106, 0.10)',
    maskTransparent: 'rgba(244, 244, 244, 0)',
    maskStart: 'rgba(244, 244, 244, 0.65)',
    maskEnd: 'rgba(244, 244, 244, 0.95)',
    shadow: '#1F2423',
  }}
/>
```

当前渐隐使用 React Native 0.86 的 `experimental_backgroundImage`。在其他 React Native 版本中复用前，需要先验证该属性是否可用。
