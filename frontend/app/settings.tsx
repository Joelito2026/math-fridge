import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { deleteAccount, updateAccountProfile } from '../src/api';
import { supabase } from '../src/services/supabase';
import { SPACING, TYPOGRAPHY } from '../src/theme';
import { AppColors, TextSizePreference, ThemePreference, usePreferences } from '../src/contexts/PreferencesContext';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' },
];
const TEXT_OPTIONS: { label: string; value: TextSizePreference }[] = [
  { label: 'Extra Small', value: 'extra-small' }, { label: 'Small', value: 'small' },
  { label: 'Default', value: 'default' }, { label: 'Large', value: 'large' }, { label: 'Extra Large', value: 'extra-large' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const preferences = usePreferences();
  const { colors, textScale } = preferences;
  const styles = createStyles(colors, textScale);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const usesPasswordSignIn = user?.identities?.some((identity) => identity.provider === 'email') ?? false;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName(data.user?.user_metadata?.full_name || '');
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setDisplayName(session?.user?.user_metadata?.full_name || '');
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveProfile = async () => {
    const normalizedName = displayName.trim().replace(/\s+/g, ' ');
    setStatus('');
    setError('');

    if (normalizedName.length < 2 || normalizedName.length > 40) {
      setError('Display name must be between 2 and 40 characters.');
      return;
    }

    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: normalizedName } });
      if (authError) throw authError;
      await updateAccountProfile(normalizedName);
      setDisplayName(normalizedName);
      setStatus('Profile saved.');
    } catch (saveError: any) {
      setError(saveError.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const permanentlyDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' || !user?.email || (usesPasswordSignIn && !deletePassword)) return;

    setDeleting(true);
    setDeleteError('');
    try {
      if (usesPasswordSignIn) {
        const { error: reauthenticationError } = await supabase.auth.signInWithPassword({ email: user.email, password: deletePassword });
        if (reauthenticationError) throw new Error('Your password was not accepted. The account was not deleted.');
      }
      await deleteAccount();
      await supabase.auth.signOut({ scope: 'local' });
      setShowDeleteModal(false);
      router.replace('/');
    } catch (caughtError: any) {
      setDeleteError(caughtError.message || 'Could not delete your account.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
      setDeleteConfirmation('');
      setDeletePassword('');
    }
  };

  if (loading) {
    return <SafeAreaView style={[styles.safeArea, styles.centered]}><ActivityIndicator size="large" color={colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.description}>Personalize Math Fridge and manage your account.</Text>

        {user ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={(value) => { setDisplayName(value); setStatus(''); setError(''); }}
            placeholder="How should we address you?"
            placeholderTextColor={colors.textSecondary}
            maxLength={40}
            autoCapitalize="words"
            editable={!saving}
          />
          <Text style={styles.helperText}>This name appears in the account menu and on recipes you share.</Text>
          <Text style={styles.label}>Email</Text>
          <View style={styles.readOnlyField}><Text style={styles.readOnlyText}>{user.email}</Text></View>
          {status ? <Text style={styles.successText}>{status}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.primaryButtonText}>Save Profile</Text>}
          </TouchableOpacity>
        </View> : <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <Text style={styles.description}>Sign in from the account menu to edit your profile, share recipes, or manage your account.</Text>
        </View>}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.label}>Theme</Text>
          <View style={styles.optionGroup} accessibilityRole="radiogroup">
            {THEME_OPTIONS.map((option) => {
              const selected = preferences.theme === option.value;
              return (
                <TouchableOpacity key={option.value} style={[styles.optionButton, selected && styles.optionButtonSelected]} onPress={() => preferences.setTheme(option.value)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Text Size</Text>
          <View style={styles.optionGroup} accessibilityRole="radiogroup">
            {TEXT_OPTIONS.map((option) => {
              const selected = preferences.textSize === option.value;
              return (
                <TouchableOpacity key={option.value} style={[styles.optionButton, selected && styles.optionButtonSelected]} onPress={() => preferences.setTextSize(option.value)} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.previewText}>Preview: Scale recipes clearly and comfortably.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}><Text style={styles.settingTitle}>Reduce Motion</Text><Text style={styles.helperText}>Use shorter, simpler drawer transitions.</Text></View>
            <Switch value={preferences.reduceMotion} onValueChange={preferences.setReduceMotion} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={colors.surface} accessibilityLabel="Reduce motion" />
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}><Text style={styles.settingTitle}>Higher Contrast</Text><Text style={styles.helperText}>Strengthen text and border contrast.</Text></View>
            <Switch value={preferences.highContrast} onValueChange={preferences.setHighContrast} trackColor={{ false: colors.secondary, true: colors.primary }} thumbColor={colors.surface} accessibilityLabel="Higher contrast" />
          </View>
          <Text style={styles.helperText}>Math Fridge also respects your device text-size setting.</Text>
          {preferences.systemReduceMotion ? <Text style={styles.systemNote}>Your device currently requests reduced motion, so animations stay reduced even if this switch is off.</Text> : null}
          <TouchableOpacity style={styles.secondaryButton} onPress={preferences.resetPreferences}>
            <Feather name="rotate-ccw" size={17} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Reset Appearance & Accessibility</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Support & Legal</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/help')}><Text style={styles.settingTitle}>Help & Support</Text><Feather name="chevron-right" size={20} color={colors.textPrimary} /></TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/legal')}><Text style={styles.settingTitle}>Privacy & Terms</Text><Feather name="chevron-right" size={20} color={colors.textPrimary} /></TouchableOpacity>
          <View style={styles.linkRow}><Text style={styles.settingTitle}>App Version</Text><Text style={styles.readOnlyText}>{Constants.expoConfig?.version || '1.0.0'}</Text></View>
        </View>

        {user ? <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.dangerTitle}>Delete Account</Text>
          <Text style={styles.description}>Permanently remove your profile, recipes, and bookmarks. This cannot be undone.</Text>
          {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
          <TouchableOpacity style={styles.deleteButton} onPress={() => { setShowDeleteModal(true); setDeleteConfirmation(''); setDeletePassword(''); setDeleteError(''); }}>
            <Feather name="trash-2" size={18} color={colors.danger} />
            <Text style={styles.deleteButtonText}>Delete My Account</Text>
          </TouchableOpacity>
        </View> : null}
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => !deleting && setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Feather name="alert-triangle" size={30} color={colors.danger} />
            <Text style={styles.modalTitle}>Permanently delete your account?</Text>
            <Text style={styles.modalText}>All recipes and bookmarks will be erased. Type DELETE to confirm.</Text>
            {usesPasswordSignIn ? <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Current password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              editable={!deleting}
              accessibilityLabel="Current password"
            /> : <Text style={styles.modalText}>You signed in with a social account, so no Math Fridge password is required.</Text>}
            <TextInput
              style={[styles.input, { marginTop: SPACING.sm }]}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, (deleteConfirmation !== 'DELETE' || (usesPasswordSignIn && !deletePassword) || deleting) && styles.disabled]}
                onPress={permanentlyDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || (usesPasswordSignIn && !deletePassword) || deleting}
              >
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmDeleteText}>Delete Forever</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors, scale: number) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', paddingVertical: SPACING.sm, marginBottom: SPACING.md },
  backButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15 * scale, color: colors.primary },
  pageTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 32 * scale, color: colors.textPrimary, marginTop: SPACING.sm },
  description: { fontFamily: TYPOGRAPHY.body, fontSize: 15 * scale, lineHeight: 23 * scale, color: colors.textSecondary, marginTop: SPACING.xs },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: SPACING.lg, borderWidth: 1, borderColor: colors.secondary, marginTop: SPACING.xl },
  sectionTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 21 * scale, color: colors.textPrimary, marginBottom: SPACING.md },
  label: { fontFamily: TYPOGRAPHY.heading, fontSize: 14 * scale, color: colors.primary, marginBottom: SPACING.xs, marginTop: SPACING.md },
  input: { width: '100%', minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.background, paddingHorizontal: SPACING.md, fontFamily: TYPOGRAPHY.body, fontSize: 16 * scale, color: colors.textPrimary },
  helperText: { fontFamily: TYPOGRAPHY.body, fontSize: 12 * scale, color: colors.textSecondary, marginTop: SPACING.xs },
  readOnlyField: { minHeight: 48, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.secondary, paddingHorizontal: SPACING.md, justifyContent: 'center' },
  readOnlyText: { fontFamily: TYPOGRAPHY.body, fontSize: 15 * scale, color: colors.textSecondary },
  primaryButton: { minHeight: 48, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  primaryButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15 * scale, color: colors.background },
  successText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13 * scale, color: colors.success, marginTop: SPACING.md },
  errorText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13 * scale, color: colors.danger, marginTop: SPACING.md },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  optionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.md, borderRadius: 22, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.background },
  optionButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 14 * scale, color: colors.textPrimary },
  optionTextSelected: { color: colors.background },
  previewText: { marginTop: SPACING.lg, fontFamily: TYPOGRAPHY.body, fontSize: 16 * scale, lineHeight: 24 * scale, color: colors.textPrimary },
  settingRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.secondary, paddingVertical: SPACING.sm },
  settingCopy: { flex: 1 },
  settingTitle: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 15 * scale, color: colors.textPrimary },
  systemNote: { marginTop: SPACING.md, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12 * scale, lineHeight: 18 * scale, color: colors.primary },
  secondaryButton: { minHeight: 46, marginTop: SPACING.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: colors.secondary, borderRadius: 9 },
  secondaryButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13 * scale, color: colors.primary },
  linkRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.secondary },
  disabled: { opacity: 0.5 },
  dangerCard: { borderColor: colors.danger },
  dangerTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 21 * scale, color: colors.danger },
  deleteButton: { minHeight: 46, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: 9, borderWidth: 1, borderColor: colors.danger, paddingHorizontal: SPACING.md, marginTop: SPACING.lg },
  deleteButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14 * scale, color: colors.danger },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { width: '100%', maxWidth: 440, borderRadius: 16, backgroundColor: colors.surface, padding: SPACING.lg, alignItems: 'center' },
  modalTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 21 * scale, color: colors.textPrimary, textAlign: 'center', marginTop: SPACING.md },
  modalText: { fontFamily: TYPOGRAPHY.body, fontSize: 14 * scale, lineHeight: 21 * scale, color: colors.textSecondary, textAlign: 'center', marginVertical: SPACING.md },
  modalActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.md },
  cancelButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14 * scale, color: colors.primary },
  confirmDeleteButton: { minHeight: 44, minWidth: 130, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md },
  confirmDeleteText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14 * scale, color: colors.background },
});
