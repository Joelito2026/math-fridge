import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { SPACING, TYPOGRAPHY } from '../src/theme';

export default function LegalScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Feather name="arrow-left" size={20} color={colors.primary} /><Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Privacy & Terms</Text>
        <Text style={styles.updated}>Product summary · Review with legal counsel before public release</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <Text style={styles.paragraph}>Math Fridge stores the account information needed to sign you in, along with recipes, bookmarks, profile settings, and sharing choices you create in the app.</Text>
          <Text style={styles.paragraph}>When you import a recipe, recipe information may be processed by the configured AI service to extract and categorize it. Public recipes are visible to other users. Recipes in My Vault remain private unless you publish them.</Text>
          <Text style={styles.paragraph}>Appearance and accessibility preferences are stored on your device. You can permanently delete your account and associated app data from Settings.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Terms of Use</Text>
          <Text style={styles.paragraph}>Recipe conversions and suggested quantities are tools for planning and are not guarantees of cooking, nutrition, allergy, or food-safety outcomes. Review ingredients and instructions before use.</Text>
          <Text style={styles.paragraph}>Only import or publish content you are permitted to use. Do not use Math Fridge to upload unlawful, harmful, or misleading material.</Text>
          <Text style={styles.paragraph}>These in-app terms are a product draft and should be replaced or approved by qualified legal counsel before a public launch.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors, scale: number) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start' },
  backText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15 * scale, color: colors.primary },
  pageTitle: { marginTop: SPACING.md, fontFamily: TYPOGRAPHY.heading, fontSize: 32 * scale, color: colors.textPrimary },
  updated: { marginTop: SPACING.xs, fontFamily: TYPOGRAPHY.body, fontSize: 12 * scale, lineHeight: 18 * scale, color: colors.textSecondary },
  card: { marginTop: SPACING.xl, padding: SPACING.lg, borderRadius: 14, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface },
  sectionTitle: { marginBottom: SPACING.md, fontFamily: TYPOGRAPHY.heading, fontSize: 21 * scale, color: colors.textPrimary },
  paragraph: { marginBottom: SPACING.md, fontFamily: TYPOGRAPHY.body, fontSize: 14 * scale, lineHeight: 22 * scale, color: colors.textSecondary },
});
