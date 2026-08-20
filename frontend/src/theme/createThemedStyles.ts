import { StyleSheet } from 'react-native';

function scaleTypography(value: any, scale: number): any {
  if (Array.isArray(value)) return value.map((item) => scaleTypography(item, scale));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if ((key === 'fontSize' || key === 'lineHeight') && typeof item === 'number') {
      return [key, Math.round(item * scale * 10) / 10];
    }
    return [key, scaleTypography(item, scale)];
  }));
}

export function createThemedStyles(styles: Record<string, any>, textScale = 1) {
  return StyleSheet.create(scaleTypography(styles, textScale));
}
