// ==================== 可拖动底部导航 ====================
// 这个组件把默认底部导航换成悬浮圆角胶囊，用户既能点击，也能左右拖动选择页面。
// React Navigation 仍保存真实页面和返回历史，这里只负责外观、触摸过程和切换时机。
// absolute（覆盖在内容上方的位置方式）让列表能继续铺到导航栏后面，不会被挤短。

import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  type DimensionValue,
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export type FloatingCapsuleTabBarColors = {
  active: string;
  inactive: string;
  capsuleBackground: string;
  capsuleBorder: string;
  indicatorBackground: string;
  maskTransparent: string;
  maskStart: string;
  maskEnd: string;
  shadow: string;
};

export type FloatingCapsuleTabBarProps = BottomTabBarProps & {
  // 图标由业务应用提供，标准组件不应知道“禁食”或“统计”等具体路由。
  icons: Readonly<Record<string, ImageSourcePropType>>;
  colors: FloatingCapsuleTabBarColors;
  capsuleWidth?: DimensionValue;
};

// ---------- 尺寸 ----------
// 最新参考图归一化到 390 宽手机后，胶囊约高 58，图标框约 26×20，文字约 10。
// 图标使用 contain 保留自身比例，避免图片被拉伸变形。
const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 12;
const SPACING_LG = 16;
const RADIUS_LG = 20;
const TAB_BAR_HEIGHT = 58;
const TAB_ICON_WIDTH = 26;
const TAB_ICON_HEIGHT = 20;
const TAB_LABEL_SIZE = 10;

// 红框参考要求列表从胶囊下半部分才开始变淡。
// 胶囊上方有 16 dp 间距，再加一半胶囊高度，正好得到屏幕上的胶囊垂直中线。
const BOTTOM_MASK_START_OFFSET = SPACING_LG + TAB_BAR_HEIGHT / 2;

// 渐变从中线前 8 dp 开始，在中线正好达到 65%，所以起点明显但没有透明度跳变。
const BOTTOM_MASK_TRANSITION_HEIGHT = SPACING_SM;

// 胶囊自身保留 4 dp 内边距；选中底色每侧再内收 2 dp，匹配参考图的细小白色间隔。
const CAPSULE_CONTENT_PADDING = SPACING_XS;
const INDICATOR_HORIZONTAL_INSET = SPACING_XS / 2;

// 手指移动超过 4 dp 且主要方向为横向时才接管手势，避免轻微抖动把普通点击误判成拖动。
const DRAG_ACTIVATION_DISTANCE = SPACING_XS;

// 弹簧参数让释放后的指示器快速吸附又不会僵硬；页面会立即切换，不需要等待动画结束。
// 禁止越过目标可避免滑块在边界闪一下；不占用交互队列可减少新页面渲染与吸附动画互相等待。
const INDICATOR_SPRING_CONFIG = {
  damping: 22,
  stiffness: 260,
  mass: 0.8,
  overshootClamping: true,
  isInteraction: false,
} as const;

// 正常选中底色约高 50 dp；放大到 1.18 后约为 59 dp，会比 58 dp 导航胶囊上下各探出一点。
// 外层没有 overflow:hidden，因此溢出部分可见，同时幅度仍不足以遮挡相邻 Tab 的文字。
const INDICATOR_ACTIVE_SCALE = 1.18;

// ---------- 位置换算 ----------
// 把任意小数限制在最小值和最大值之间，防止手指滑出胶囊后选中底色也跑到外面。
function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

// 把本次横向位移换算成“第几个 Tab”的连续位置。
// 例如从首页（0）向右移动半格会得到 0.5；宽度尚未测量时保持原位，避免除以 0。
export function calculateDragPosition(
  startPosition: number,
  dragDistance: number,
  segmentWidth: number,
  tabCount: number,
) {
  if (segmentWidth <= 0 || tabCount <= 0) {
    return startPosition;
  }

  return clamp(
    startPosition + dragDistance / segmentWidth,
    0,
    tabCount - 1,
  );
}

// 松手时选择距离指示器最近的整数格，并再次限制边界以保护异常输入。
export function getNearestTabIndex(position: number, tabCount: number) {
  if (tabCount <= 0) {
    return 0;
  }

  return Math.round(clamp(position, 0, tabCount - 1));
}

// 优先使用导航配置给出的中文 title；缺失时才退回稳定路由名，避免标签显示为空。
function getTabLabel(title: string | undefined, routeName: string) {
  return title ?? routeName;
}

// ==================== 触摸与页面切换 ====================
// 每次真实选中页面变化时，React Navigation 都会把最新状态重新传入这个组件。
// 点击和拖动最终都进入同一条“发出 tabPress → 吸附 → 动画完成后导航”的流程，
// 所以手指仍按住或胶囊仍在移动时，页面不会提前切换。
export function FloatingCapsuleTabBar({
  state,
  descriptors,
  navigation,
  insets,
  icons,
  colors,
  capsuleWidth = '70%',
}: FloatingCapsuleTabBarProps) {
  // React Navigation 会提供当前手机的安全区；bottomInset 是底部系统手势条占用的高度。
  const bottomInset = insets.bottom;

  // onLayout 会写入胶囊真实宽度；旋转屏幕或窗口尺寸变化后会自动重新计算每一格。
  const [measuredCapsuleWidth, setMeasuredCapsuleWidth] = useState(0);

  // previewIndex 像“手指当前指到哪里”的临时记号，只改变颜色，不代表页面已经切换。
  const [previewIndex, setPreviewIndex] = useState(state.index);

  // Animated.Value（动画中的数字）用 0、1 代表两个入口，0.5 就是在它们中间。
  const indicatorPosition = useRef(new Animated.Value(state.index)).current;

  // scale 从 1 放大到 1.18，再在吸附时回到 1，形成参考 GIF 中越过栏高的按下反馈。
  const indicatorScale = useRef(new Animated.Value(1)).current;

  // ref（不会引起页面重画的小记事本）保存手指每一帧的位置，避免拖动时不停重画整条导航栏。
  const visualPositionRef = useRef(state.index);
  // 目标位置单独保存；页面立即切换后，外部导航状态会随之更新，但不能把同一段动画重新启动。
  const indicatorTargetIndexRef = useRef(state.index);
  const dragStartPositionRef = useRef(state.index);
  const isDraggingRef = useRef(false);
  const indicatorAnimationRef = useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const indicatorScaleAnimationRef =
    useRef<Animated.CompositeAnimation | null>(null);
  const hasDraggedRef = useRef(false);
  const isVerticalGestureRef = useRef(false);
  // 旧的原生动画停止后才知道滑块真实位置；在结果回来前，先暂存最新拖动距离，避免起点中途变化。
  const isDragStartReadyRef = useRef(true);
  const pendingDragDistanceRef = useRef(0);

  // measureInWindow 会保存胶囊相对屏幕的左边界，供普通点击把 pageX 精确换算成对应入口。
  const capsuleRef = useRef<View | null>(null);
  const capsulePageXRef = useRef(0);

  const tabCount = state.routes.length;
  const segmentWidth =
    measuredCapsuleWidth > CAPSULE_CONTENT_PADDING * 2 && tabCount > 0
      ? (measuredCapsuleWidth - CAPSULE_CONTENT_PADDING * 2) / tabCount
      : 0;
  const indicatorWidth = Math.max(
    segmentWidth - INDICATOR_HORIZONTAL_INSET * 2,
    0,
  );

  // ---------- 吸附动画 ----------
  // 新动画开始前先停掉旧动画，再同时完成“滑到目标格”和“缩回正常大小”。
  // 这段动画只负责视觉反馈；页面切换由 settleToTab 在用户确认选择时立即完成。
  const animateIndicatorTo = useCallback(
    (targetIndex: number) => {
      indicatorAnimationRef.current?.stop();
      indicatorScaleAnimationRef.current?.stop();
      indicatorTargetIndexRef.current = targetIndex;
      setPreviewIndex(targetIndex);

      const animation = Animated.parallel([
        Animated.spring(indicatorPosition, {
          toValue: targetIndex,
          useNativeDriver: true,
          ...INDICATOR_SPRING_CONFIG,
        }),
        Animated.spring(indicatorScale, {
          toValue: 1,
          useNativeDriver: true,
          ...INDICATOR_SPRING_CONFIG,
        }),
      ]);

      indicatorAnimationRef.current = animation;
      animation.start(({finished}) => {
        const isCurrentAnimation = indicatorAnimationRef.current === animation;

        if (isCurrentAnimation) {
          indicatorAnimationRef.current = null;
        }

        // 已被新触摸替换的旧动画即使晚到，也不能把当前位置改回旧目标。
        if (finished && isCurrentAnimation) {
          visualPositionRef.current = targetIndex;
        }
      });
    },
    [indicatorPosition, indicatorScale],
  );

  // 按住时放大选中胶囊；拖动期间保持该比例，直到释放吸附动画统一缩回。
  const enlargeIndicator = useCallback(() => {
    indicatorScaleAnimationRef.current?.stop();

    const animation = Animated.spring(indicatorScale, {
      toValue: INDICATOR_ACTIVE_SCALE,
      useNativeDriver: true,
      ...INDICATOR_SPRING_CONFIG,
    });

    indicatorScaleAnimationRef.current = animation;
    animation.start(({finished}) => {
      if (finished && indicatorScaleAnimationRef.current === animation) {
        indicatorScaleAnimationRef.current = null;
      }
    });
  }, [indicatorScale]);

  // ---------- 拖动位置更新 ----------
  // 所有拖动帧走同一条换算流程；旧动画停止稍慢时，只保留最后一次手指距离，不绘制错误的中间位置。
  const applyDragDistance = useCallback(
    (dragDistance: number) => {
      const nextPosition = calculateDragPosition(
        dragStartPositionRef.current,
        dragDistance,
        segmentWidth,
        tabCount,
      );
      const nextPreviewIndex = getNearestTabIndex(nextPosition, tabCount);

      visualPositionRef.current = nextPosition;
      indicatorPosition.setValue(nextPosition);
      setPreviewIndex(currentIndex =>
        currentIndex === nextPreviewIndex ? currentIndex : nextPreviewIndex,
      );
    },
    [indicatorPosition, segmentWidth, tabCount],
  );

  // ---------- 提交选择 ----------
  // 点击或松手后先询问导航监听方是否允许切换，再让底色吸附到最终位置。
  // 目标不同且切换未被阻止时立即显示新页面，底色动画在新页面显示后继续完成。
  const settleToTab = useCallback(
    (requestedIndex: number) => {
      const targetIndex = getNearestTabIndex(requestedIndex, tabCount);
      const targetRoute = state.routes[targetIndex];

      if (targetRoute === undefined) {
        isDraggingRef.current = false;
        animateIndicatorTo(state.index);
        return;
      }

      const event = navigation.emit({
        type: 'tabPress',
        target: targetRoute.key,
        canPreventDefault: true,
      });
      const shouldNavigate =
        targetIndex !== state.index && !event.defaultPrevented;
      const finalIndex = shouldNavigate ? targetIndex : state.index;

      isDraggingRef.current = false;
      animateIndicatorTo(finalIndex);

      if (shouldNavigate) {
        navigation.navigate(targetRoute.name, targetRoute.params);
      }
    },
    [
      animateIndicatorTo,
      navigation,
      state.index,
      state.routes,
      tabCount,
    ],
  );

  // 手势被系统取消时不改页面，指示器回到导航器当前确认的 Tab。
  const cancelDrag = useCallback(() => {
    isDraggingRef.current = false;
    isDragStartReadyRef.current = false;
    pendingDragDistanceRef.current = 0;
    animateIndicatorTo(state.index);
  }, [animateIndicatorTo, state.index]);

  // ---------- 手指轨迹 ----------
  // PanResponder（统一接收按下、移动和松手的工具）从按下开始掌管整条胶囊。
  // 这样手指跨过多个按钮时轨迹也不会断；没有形成拖动时，再用松手坐标判断点了哪一格。
  // 子 Pressable 仍保留 onPress，方便屏幕阅读器等无障碍工具直接激活入口。
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          hasDraggedRef.current = false;
          isVerticalGestureRef.current = false;
          isDragStartReadyRef.current = false;
          pendingDragDistanceRef.current = 0;

          const runningAnimation = indicatorAnimationRef.current;
          indicatorAnimationRef.current = null;
          runningAnimation?.stop();
          enlargeIndicator();

          // 如果用户在吸附动画尚未结束时再次按住，从屏幕上的当前位置继续，不会跳回旧格。
          indicatorPosition.stopAnimation(currentPosition => {
            if (!isDraggingRef.current) {
              return;
            }

            visualPositionRef.current = currentPosition;
            dragStartPositionRef.current = currentPosition;
            isDragStartReadyRef.current = true;

            if (pendingDragDistanceRef.current !== 0) {
              applyDragDistance(pendingDragDistanceRef.current);
            }
          });
        },
        onPanResponderMove: (_, gestureState) => {
          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);

          if (
            !hasDraggedRef.current &&
            verticalDistance > DRAG_ACTIVATION_DISTANCE &&
            verticalDistance > horizontalDistance
          ) {
            isVerticalGestureRef.current = true;
            return;
          }

          if (
            isVerticalGestureRef.current ||
            horizontalDistance <= DRAG_ACTIVATION_DISTANCE
          ) {
            return;
          }

          hasDraggedRef.current = true;
          pendingDragDistanceRef.current = gestureState.dx;

          if (isDragStartReadyRef.current) {
            applyDragDistance(gestureState.dx);
          }
        },
        onPanResponderRelease: (event, gestureState) => {
          if (isVerticalGestureRef.current) {
            cancelDrag();
            return;
          }

          if (hasDraggedRef.current) {
            const releasePosition = isDragStartReadyRef.current
              ? visualPositionRef.current
              : calculateDragPosition(
                  state.index,
                  gestureState.dx,
                  segmentWidth,
                  tabCount,
                );
            isDraggingRef.current = false;
            isDragStartReadyRef.current = false;
            pendingDragDistanceRef.current = 0;
            settleToTab(
              getNearestTabIndex(releasePosition, tabCount),
            );
            return;
          }

          // 某些 Android 版本松手时会错误地给出横坐标 0。
          // 因此依次尝试最后位置、按下起点和原始事件，三个都不可用时才回到当前格中央。
          const releasePageX =
            gestureState.moveX > 0
              ? gestureState.moveX
              : gestureState.x0 > 0
                ? gestureState.x0
                : event.nativeEvent.pageX;
          const releaseLocationX = releasePageX > 0
            ? releasePageX - capsulePageXRef.current
            : CAPSULE_CONTENT_PADDING +
              (state.index + 0.5) * segmentWidth;
          const tapPosition =
            segmentWidth > 0
              ? (releaseLocationX - CAPSULE_CONTENT_PADDING) / segmentWidth -
                0.5
              : state.index;

          settleToTab(getNearestTabIndex(tapPosition, tabCount));
        },
        onPanResponderTerminate: cancelDrag,
        // 一旦横向选择开始就不把响应权交回子按钮，否则长拖动会在中途被 Pressable 取消。
        // 系统强制终止时仍会进入 onPanResponderTerminate，并安全回到当前已确认页面。
        onPanResponderTerminationRequest: () => false,
      }),
    [
      cancelDrag,
      enlargeIndicator,
      indicatorPosition,
      applyDragDistance,
      segmentWidth,
      settleToTab,
      state.index,
      tabCount,
    ],
  );

  // ---------- 外部页面变化 ----------
  // 外部链接或系统返回也可能改变当前页面；没有拖动时才同步底色，拖动中不能抢走手指控制权。
  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    if (
      visualPositionRef.current === state.index ||
      indicatorTargetIndexRef.current === state.index
    ) {
      setPreviewIndex(state.index);
      return;
    }

    animateIndicatorTo(state.index);
  }, [animateIndicatorTo, state.index]);

  // 组件卸载时停止动画，防止已离开的导航树收到完成回调并触发过期跳转。
  useEffect(
    () => () => {
      indicatorAnimationRef.current?.stop();
      indicatorScaleAnimationRef.current?.stop();
    },
    [],
  );

  // ---------- 尺寸测量 ----------
  // 手机旋转或窗口改变后重新记录胶囊宽度；不足半个像素的误差不会触发多余重画。
  const handleCapsuleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;

    setMeasuredCapsuleWidth(currentWidth =>
      Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth,
    );

    // measureInWindow 返回相对屏幕的 x，普通点击据此能在任何屏宽和安全区下正确选择入口。
    capsuleRef.current?.measureInWindow(windowX => {
      capsulePageXRef.current = windowX;
    });
  }, []);

  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={styles.safeArea}
      edges={['right', 'bottom', 'left']}>
      <View pointerEvents="box-none" style={styles.barArea}>
        <View
          pointerEvents="none"
          style={[
            styles.maskArea,
            {
              bottom: -bottomInset,
              experimental_backgroundImage: `linear-gradient(to bottom, ${colors.maskTransparent} 0px, ${colors.maskStart} ${BOTTOM_MASK_TRANSITION_HEIGHT}px, ${colors.maskEnd} 100%)`,
            },
          ]}
        />
        <View
          {...panResponder.panHandlers}
          onLayout={handleCapsuleLayout}
          ref={capsuleRef}
          style={[
            styles.capsule,
            {
              width: capsuleWidth,
              backgroundColor: colors.capsuleBackground,
              borderColor: colors.capsuleBorder,
              shadowColor: colors.shadow,
            },
          ]}
          testID="main-tab-drag-surface">
          {indicatorWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeIndicatorTrack,
                {
                  left:
                    CAPSULE_CONTENT_PADDING + INDICATOR_HORIZONTAL_INSET,
                  width: indicatorWidth,
                  transform: [
                    {
                      translateX: Animated.multiply(
                        indicatorPosition,
                        segmentWidth,
                      ),
                    },
                  ],
                },
              ]}
              testID="tab-selection-indicator">
              <Animated.View
                style={[
                  styles.activeIndicator,
                  {
                    backgroundColor: colors.indicatorBackground,
                    transform: [{scale: indicatorScale}],
                  },
                ]}
              />
            </Animated.View>
          )}
          {state.routes.map((route, index) => {
            const routeName = route.name;
            const icon = icons[routeName];

            // 路由没有配置图标时安全跳过，避免把 undefined 交给原生 Image 导致运行时错误。
            if (icon === undefined) {
              return null;
            }

            const isFocused = previewIndex === index;
            const options = descriptors[route.key].options;
            const label = getTabLabel(options.title, routeName);
            const foregroundColor = isFocused
              ? colors.active
              : colors.inactive;

            const handleLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                accessibilityState={isFocused ? {selected: true} : {}}
                onLongPress={handleLongPress}
                onPress={() => settleToTab(index)}
                style={styles.pressable}
                testID={options.tabBarButtonTestID}>
                {({pressed}) => (
                  <View
                    style={[
                      styles.tab,
                      pressed && styles.pressedTab,
                    ]}>
                    <Image
                      resizeMode="contain"
                      source={icon}
                      style={[
                        styles.tabIcon,
                        {tintColor: foregroundColor},
                      ]}
                    />
                    <Text style={[styles.label, {color: foregroundColor}]}>
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ==================== 底部导航样式 ====================
const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
    // RNSScreen 在 Android 使用独立原生绘制层，蒙版必须高于它才能真正盖住列表内容。
    // 这里只提升透明根层的绘制顺序，不再执行会扩散亮色像素的实时模糊，因此不会产生此前的白色眩光。
    elevation: 10,
    backgroundColor: 'transparent',
  },
  barArea: {
    // Android 会把 RNSScreen 作为独立原生层绘制；蒙版放进这个已提升的容器后才会盖住列表。
    zIndex: 11,
    elevation: 11,
    alignItems: 'center',
    paddingTop: SPACING_LG,
    paddingHorizontal: SPACING_SM,
    paddingBottom: SPACING_SM,
  },
  maskArea: {
    position: 'absolute',
    // React Native 0.86 由原生视图直接绘制一整条线性渐变，不再拉伸 PNG 或叠加实色层。
    // 三个颜色应由调用方提供同一页面底色，只连续改变透明度，避免中线出现硬边或亮色带。
    top: BOTTOM_MASK_START_OFFSET - BOTTOM_MASK_TRANSITION_HEIGHT,
    right: 0,
    left: 0,
    zIndex: 0,
  },
  capsule: {
    position: 'relative',
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    padding: SPACING_XS,
    // 胶囊使用全局纯白透明底色；后方遮罩使用页面同色连续渐变，不再有分层接缝。
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS_LG + SPACING_SM,
    shadowOffset: {width: 0, height: SPACING_XS},
    shadowOpacity: 0.06,
    shadowRadius: SPACING_SM,
    // Android 的 elevation 会让半透明圆角中央重复混合，产生只出现在矩形区域的亮色横线。
    // iOS 继续使用上面的 shadow 配置；Android 关闭 elevation 后保留真实透明度并消除接缝。
    elevation: 0,
  },
  pressable: {
    flex: 1,
    zIndex: 1,
  },
  activeIndicatorTrack: {
    position: 'absolute',
    top: CAPSULE_CONTENT_PADDING,
    bottom: CAPSULE_CONTENT_PADDING,
  },
  activeIndicator: {
    flex: 1,
    borderRadius: RADIUS_LG + SPACING_XS,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING_XS,
    marginHorizontal: SPACING_SM,
  },
  tabIcon: {
    width: TAB_ICON_WIDTH,
    height: TAB_ICON_HEIGHT,
  },
  pressedTab: {
    opacity: 0.7,
  },
  label: {
    fontSize: TAB_LABEL_SIZE,
    fontWeight: '500',
    lineHeight: SPACING_MD,
  },
});
