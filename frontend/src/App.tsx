import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import { 
  BerkshireSwash_400Regular 
} from '@expo-google-fonts/berkshire-swash';

// Import the DNA file you just built
import { COLORS, TYPOGRAPHY } from './theme';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-Bold': Poppins_700Bold,
    'BerkshireSwash-Regular': BerkshireSwash_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // The splash screen handles the visual loading state
  }

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      {/* This is a temporary sandbox view just to prove 
        your custom theme is working before we build real components. 
      */}
      <Text style={styles.logoText}>Math Fridge</Text>
      <Text style={styles.bodyText}>Your design system is online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: TYPOGRAPHY.logo,
    fontSize: 42,
    color: COLORS.primary,
    marginBottom: 8,
  },
  bodyText: {
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});