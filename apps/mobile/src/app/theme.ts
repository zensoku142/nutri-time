// ==================== 界面基础样式 ====================
// 颜色、间距和圆角集中在这里命名，调整整体外观时便不必逐页寻找相同数值。
// 当前只收录已经在页面中使用的项目，不提前加入还没有实际用途的样式。

const PAGE_BACKGROUND = '#F4F4F4';

// 蒙版与页面共用同一个十六进制颜色来源，只额外设置透明度，避免背景改色后底部仍残留旧色。
function hexToRgba(hexColor: string, alpha: number) {
  const channels = /^#([\dA-F]{2})([\dA-F]{2})([\dA-F]{2})$/i.exec(hexColor);

  if (channels === null) {
    throw new Error('页面背景色必须使用 #RRGGBB 格式');
  }

  const [, red, green, blue] = channels;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`;
}

export const theme = {
  colors: {
    // background 是页面底布，surface 是盖在上面的卡片；两者分开才能看出内容层次。
    background: PAGE_BACKGROUND,
    surface: '#F6F6F4',
    text: '#1F2423',
    textSecondary: '#6B7270',
    primary: '#426561',
    navigationActive: '#FF786A',
    navigationInactive: '#969696',
    // RGBA（带透明度的颜色）最后一个数字越小，越能看见它下面的颜色。
    navigationBorder: 'rgba(255, 255, 255, 0.94)',
    // buttonBackground 是按钮共用的纯白透明底色；导航胶囊复用它，避免重复填写同一种颜色。
    buttonBackground: 'rgba(255, 255, 255, 0.82)',
    navigationActiveBackground: 'rgba(255, 120, 106, 0.10)',
    // 底部遮罩必须使用页面底色的 RGB；若改成白色，半透明区域会叠亮并形成白色雾带。
    navigationMaskTransparent: hexToRgba(PAGE_BACKGROUND, 0),
    navigationMaskStart: hexToRgba(PAGE_BACKGROUND, 0.65),
    navigationMaskEnd: hexToRgba(PAGE_BACKGROUND, 0.95),
    border: '#E3E6E4',
    danger: '#C94747',
  },
  fonts: {
    // React Native 使用字体文件名（不含扩展名）查找安装包内资源；两个名称必须与 assets/fonts 保持一致。
    // displayAmount 用于首页总额等重点大数字，number 用于列表金额、日期时间和其他普通数字。
    displayAmount: 'ICDIN-Bold',
    number: 'Quicksand-Bold',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
  },
} as const;
