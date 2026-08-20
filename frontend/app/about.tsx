import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';

export default function AboutScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'About Math Fridge' }} />

      <View style={styles.contentContainer}>
        {/* Action Area for Back Button */}
        <View style={styles.actionArea}>
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }} 
            style={styles.backButtonFilled}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={COLORS.primary} />
            <Text style={styles.backTextFilled}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>About Math Fridge</Text>
          
          <View style={styles.card}>
            <Text style={styles.paragraph}>
              Math Fridge is a dynamic recipe utility designed to handle the complex logistics of scaling ingredients. 
            </Text>
            <Text style={styles.paragraph}>
              Instead of simple multipliers that result in unmeasurable fractions, this app uses atomic scaling to ensure your target yield produces exact, kitchen-ready measurements.
            </Text>
            
            <View style={styles.divider} />
            
            <Text style={styles.comingSoonTitle}>Coming Soon (v2.0)</Text>
            <Text style={styles.paragraph}>
              • Advanced equipment constraint settings (e.g., Stand Mixer volume limits).{"\n"}
              • Automated fraction simplification.{"\n"}
              • More details will be available later.
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  container: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: { flex: 1, width: '100%', maxWidth: 1250, alignSelf: 'center' },
  actionArea: { 
    paddingHorizontal: SPACING.lg, 
    paddingTop: SPACING.lg, 
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start',
  },
  backButtonFilled: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    gap: SPACING.xs,
  },
  backTextFilled: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary, 
    marginTop: 2, 
  },
  content: { padding: SPACING.lg },
  pageTitle: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 32, 
    color: COLORS.textPrimary, 
    marginBottom: SPACING.md 
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  paragraph: {
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  divider: { 
    height: 1, 
    backgroundColor: COLORS.secondary, 
    marginVertical: SPACING.lg, 
    opacity: 0.5 
  },
  comingSoonTitle: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  }
}, textScale);
