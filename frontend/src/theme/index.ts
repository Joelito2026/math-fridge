// src/theme/index.js
import { Platform } from 'react-native';

export type ShadowLevel = 'subtle' | 'card' | 'elevated';

export function getShadowStyle(level: ShadowLevel = 'subtle') {
  const specs = level === 'elevated'
    ? { y: 8, blur: 20, opacity: 0.22, elevation: 8 }
    : level === 'card'
      ? { y: 6, blur: 18, opacity: 0.16, elevation: 4 }
      : { y: 2, blur: 8, opacity: 0.1, elevation: 2 };

  return Platform.select({
    web: { boxShadow: `0px ${specs.y}px ${specs.blur}px rgba(0, 0, 0, ${specs.opacity})` },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: specs.y },
      shadowOpacity: specs.opacity,
      shadowRadius: specs.blur / 2,
      elevation: specs.elevation,
    },
  }) || {};
}

export const COLORS = {
    // Brand Colors from your palette
    primary: '#4A3024', // The dark chocolate brown
    secondary: '#D6C5B3', // The warm tan
    
    // Base Colors
    background: '#FFFFFF', // Clean white for readability
    surface: '#F8F5F2', // A very light off-white for ingredient cards
    
    // Text Colors
    textPrimary: '#2A1C15', // Almost black-brown for high contrast Poppins text
    textSecondary: '#7A6B63', // Lighter brown for timestamps or minor details
  } as const;
  
  export const TYPOGRAPHY = {
    // You will need to load these via Expo Google Fonts in the next step
    logo: 'BerkshireSwash-Regular',
    heading: 'Poppins-Bold',
    body: 'Poppins-Regular',
    bodyMedium: 'Poppins-Medium',
  } as const;
  
  export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  } as const;
