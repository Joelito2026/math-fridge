// app/_layout.tsx
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router'; // Swapped Slot for Stack to enable the global Header
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import { BerkshireSwash_400Regular } from '@expo-google-fonts/berkshire-swash';

// 1. STRICTLY PULLING FROM YOUR THEME
import { COLORS, TYPOGRAPHY } from '../src/theme'; 
import Header from '../src/components/Header';
import { PreferencesProvider, usePreferences } from '../src/contexts/PreferencesContext';
import NotificationNavigation from '../src/NotificationNavigation';

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { colors, isDark } = usePreferences();
  
  // 2. STRICTLY USING YOUR THEME VARIABLES AS THE KEYS
  const [fontsLoaded, fontError] = useFonts({
    [TYPOGRAPHY.body]: Poppins_400Regular,
    [TYPOGRAPHY.bodyMedium]: Poppins_500Medium,
    [TYPOGRAPHY.heading]: Poppins_700Bold,
    [TYPOGRAPHY.logo]: BerkshireSwash_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayoutRootView();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; 
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
      <NotificationNavigation />
      {/* 3. INJECTING YOUR UNIVERSAL HEADER */}
      <Stack
        screenOptions={{
          header: () => <Header />,
          contentStyle: { backgroundColor: colors.background },
          statusBarStyle: isDark ? 'light' : 'dark',
        }}
      >
        {/* Your screens will automatically inherit the Header above */}
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PreferencesProvider><AppShell /></PreferencesProvider>
    </GestureHandlerRootView>
  );
}
