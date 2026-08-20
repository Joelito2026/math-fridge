import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';
export type TextSizePreference = 'extra-small' | 'small' | 'default' | 'large' | 'extra-large';

type Preferences = {
  theme: ThemePreference;
  textSize: TextSizePreference;
  reduceMotion: boolean;
  highContrast: boolean;
};

export type AppColors = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
  success: string;
  overlay: string;
};

const STORAGE_KEY = 'math-fridge.preferences.v1';
const DEFAULTS: Preferences = { theme: 'system', textSize: 'default', reduceMotion: false, highContrast: false };

const LIGHT_COLORS: AppColors = {
  primary: '#4A3024', secondary: '#D6C5B3', background: '#FFFFFF', surface: '#F8F5F2',
  textPrimary: '#2A1C15', textSecondary: '#6F6058', danger: '#B3261E', success: '#2E7D32', overlay: 'rgba(0,0,0,0.5)',
};

const DARK_COLORS: AppColors = {
  primary: '#E2C5AD', secondary: '#6E5849', background: '#17120F', surface: '#251D19',
  textPrimary: '#FFF8F2', textSecondary: '#D3C3B8', danger: '#FFB4AB', success: '#9AD69F', overlay: 'rgba(0,0,0,0.72)',
};

type PreferencesContextValue = Preferences & {
  loaded: boolean;
  isDark: boolean;
  colors: AppColors;
  textScale: number;
  setTheme: (value: ThemePreference) => void;
  setTextSize: (value: TextSizePreference) => void;
  setReduceMotion: (value: boolean) => void;
  setHighContrast: (value: boolean) => void;
  resetPreferences: () => void;
  systemReduceMotion: boolean;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

async function readPreferences() {
  try {
    const stored = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(STORAGE_KEY)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } as Preferences : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function writePreferences(value: Preferences) {
  const serialized = JSON.stringify(value);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
  else await SecureStore.setItemAsync(STORAGE_KEY, serialized);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const systemTheme = useColorScheme();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    readPreferences().then((saved) => { setPreferences(saved); setLoaded(true); });
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (loaded) void writePreferences(preferences);
  }, [loaded, preferences]);

  const isDark = preferences.theme === 'dark' || (preferences.theme === 'system' && systemTheme === 'dark');
  const colors = useMemo(() => {
    const base = isDark ? DARK_COLORS : LIGHT_COLORS;
    if (!preferences.highContrast) return base;
    return { ...base, textPrimary: isDark ? '#FFFFFF' : '#120A06', textSecondary: isDark ? '#F1E7DF' : '#493A32', secondary: isDark ? '#967965' : '#A98970' };
  }, [isDark, preferences.highContrast]);
  const textScale = preferences.textSize === 'extra-large' ? 1.25
    : preferences.textSize === 'large' ? 1.12
    : preferences.textSize === 'small' ? 0.9
    : preferences.textSize === 'extra-small' ? 0.8
    : 1;

  const value = useMemo<PreferencesContextValue>(() => ({
    ...preferences, reduceMotion: preferences.reduceMotion || systemReduceMotion,
    loaded, isDark, colors, textScale, systemReduceMotion,
    setTheme: (theme) => setPreferences((current) => ({ ...current, theme })),
    setTextSize: (textSize) => setPreferences((current) => ({ ...current, textSize })),
    setReduceMotion: (reduceMotion) => setPreferences((current) => ({ ...current, reduceMotion })),
    setHighContrast: (highContrast) => setPreferences((current) => ({ ...current, highContrast })),
    resetPreferences: () => setPreferences(DEFAULTS),
  }), [preferences, loaded, isDark, colors, textScale, systemReduceMotion]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside PreferencesProvider');
  return value;
}
