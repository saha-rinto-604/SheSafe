/**
 * Root constants/theme.ts — Platform fonts + dark mode Colors.
 * Kept in sync with src/constants/theme.ts design tokens.
 */

import { Platform } from 'react-native';

const tintColorDark = '#A78BFA';

export const Colors = {
  light: {
    text: '#F5F5F7',
    background: '#000000',
    tint: '#8A38F6',
    icon: '#8E8E93',
    tabIconDefault: '#636366',
    tabIconSelected: '#8A38F6',
  },
  dark: {
    text: '#F5F5F7',
    background: '#000000',
    tint: tintColorDark,
    icon: '#8E8E93',
    tabIconDefault: '#636366',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
