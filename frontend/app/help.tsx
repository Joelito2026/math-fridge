import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { SPACING, TYPOGRAPHY } from '../src/theme';

const QUESTIONS = [
  { title: 'How do I use Focus Mode?', answer: 'Open a recipe, adjust its Target Yield if needed, then choose Start Cooking. Focus Mode shows one instruction at a time, keeps your scaled ingredients nearby, and prevents supported devices from sleeping while you cook.' },
  { title: 'How do cooking timers work?', answer: 'When a Focus Mode step includes a duration, Math Fridge offers a matching timer, or you can set a custom one. The timer keeps running as you change steps and is restored with your cooking progress if you leave. On supported mobile devices, allow notifications so it can alert you in the background and return you to the correct step.' },
  { title: 'How does recipe scaling work?', answer: 'Choose a target yield on a recipe. Math Fridge scales every linked ingredient from the original recipe ratio while keeping your saved recipe unchanged.' },
  { title: 'Why are some ingredients rounded?', answer: 'Whole items such as eggs round up to usable quantities. Fractional items can round to kitchen-friendly quarter measurements, while flour and liquids remain continuously scalable.' },
  { title: 'What does adjusting one ingredient do?', answer: 'A manual adjustment becomes the new anchor for that ingredient. Linked ingredients continue following the recipe ratio when you change the yield.' },
  { title: 'Where are my saved recipes?', answer: 'Your own recipes appear in My Vault. Recipes saved from Community appear under Bookmarks in the account menu.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={colors.primary} /><Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Help & Support</Text>
        <Text style={styles.description}>Quick answers for saving, scaling, and organizing your recipes.</Text>

        <View style={styles.card}>
          {QUESTIONS.map((item, index) => {
            const expanded = openQuestion === index;
            return (
              <View key={item.title} style={styles.questionBlock}>
                <TouchableOpacity style={styles.questionButton} onPress={() => setOpenQuestion(expanded ? null : index)} accessibilityRole="button" accessibilityState={{ expanded }}>
                  <Text style={styles.questionTitle}>{item.title}</Text><Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                {expanded ? <Text style={styles.answer}>{item.answer}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Feather name="message-circle" size={26} color={colors.textPrimary} />
          <Text style={styles.sectionTitle}>Still need help?</Text>
          <Text style={styles.description}>Send feedback or report a problem and include what you were trying to do.</Text>
          <TouchableOpacity style={[styles.primaryButton, !supportEmail && styles.disabled]} disabled={!supportEmail} onPress={() => supportEmail && void Linking.openURL(`mailto:${supportEmail}?subject=Math%20Fridge%20Support`)} accessibilityRole="link">
            <Text style={styles.primaryButtonText}>{supportEmail ? 'Contact Support' : 'Support Email Not Configured'}</Text>
          </TouchableOpacity>
          {!supportEmail ? <Text style={styles.configurationNote}>Set EXPO_PUBLIC_SUPPORT_EMAIL before release to enable support requests.</Text> : null}
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
  description: { marginTop: SPACING.xs, fontFamily: TYPOGRAPHY.body, fontSize: 15 * scale, lineHeight: 23 * scale, color: colors.textSecondary },
  card: { marginTop: SPACING.xl, padding: SPACING.lg, borderRadius: 14, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface },
  questionBlock: { borderBottomWidth: 1, borderBottomColor: colors.secondary },
  questionButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  questionTitle: { flex: 1, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 15 * scale, color: colors.textPrimary },
  answer: { paddingBottom: SPACING.lg, fontFamily: TYPOGRAPHY.body, fontSize: 14 * scale, lineHeight: 22 * scale, color: colors.textSecondary },
  sectionTitle: { marginTop: SPACING.sm, fontFamily: TYPOGRAPHY.heading, fontSize: 21 * scale, color: colors.textPrimary },
  primaryButton: { minHeight: 48, marginTop: SPACING.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.primary },
  primaryButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15 * scale, color: colors.background },
  disabled: { opacity: 0.55 },
  configurationNote: { marginTop: SPACING.sm, textAlign: 'center', fontFamily: TYPOGRAPHY.body, fontSize: 12 * scale, color: colors.textSecondary },
});
