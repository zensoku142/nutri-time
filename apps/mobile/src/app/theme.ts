// ==================== 界面基础样式 ====================
// 颜色、间距和圆角集中在这里命名，调整整体外观时便不必逐页寻找相同数值。
// 当前只收录已经在页面中使用的项目，不提前加入还没有实际用途的样式。

const PAGE_BACKGROUND = '#E7F8F2';

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
    surface: '#FFFFFF',
    text: '#182238',
    textSecondary: '#626A7B',
    primary: '#61D1A9',
    fastingActive: '#61D1A9',
    navigationActive: '#61D1A9',
    navigationInactive: '#999EAA',
    // RGBA（带透明度的颜色）最后一个数字越小，越能看见它下面的颜色。
    navigationBorder: 'rgba(255, 255, 255, 0.94)',
    // 参考应用使用纯白卡片承载浅绿色页面；导航胶囊和时间选择框复用同一白色，避免出现多种近似白。
    buttonBackground: '#FFFFFF',
    navigationActiveBackground: '#DAF1E7',
    // 主操作按钮与断食进度共用青绿色，白字负责保证按钮文字在浅色页面上足够清楚。
    primaryButtonText: '#FFFFFF',
    backdrop: 'rgba(24, 34, 56, 0.58)',
    // 滚轮中间行只需要轻微区分；透明度过高会遮住三列数字，失去参考实现的轻盈层次。
    pickerHighlight: 'rgba(24, 34, 56, 0.03)',
    // 底部遮罩必须使用页面底色的 RGB；若改成白色，半透明区域会叠亮并形成白色雾带。
    navigationMaskTransparent: hexToRgba(PAGE_BACKGROUND, 0),
    navigationMaskStart: hexToRgba(PAGE_BACKGROUND, 0.65),
    navigationMaskEnd: hexToRgba(PAGE_BACKGROUND, 0.95),
    border: '#D3F2EA',
    danger: '#FF6B6B',
  },
  fonts: {
    // Android 的 sans-serif 就是系统 Roboto；直接复用系统字库，中文缺字也会自动找到手机自带字体补齐。
    // medium 用于标题与按钮，displayAmount 和 number 保留旧名称，已有页面无需同步修改调用方式。
    body: 'sans-serif',
    medium: 'sans-serif-medium',
    displayAmount: 'sans-serif-medium',
    number: 'sans-serif-medium',
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
    button: 24,
  },
} as const;
