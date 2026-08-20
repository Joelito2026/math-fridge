import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { createSessionFromUrl } from '../../src/services/socialAuth';
import { usePreferences } from '../../src/contexts/PreferencesContext';
import { TYPOGRAPHY } from '../../src/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = usePreferences();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preparing, setPreparing] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const prepareRecovery = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          const callbackUrl = await Linking.getInitialURL();
          if (!callbackUrl) throw new Error('The password reset link is incomplete.');
          await createSessionFromUrl(callbackUrl);
        }
        if (active) setCanReset(true);
      } catch (error: any) {
        if (active) {
          setIsError(true);
          setMessage(error.message || 'This password reset link is invalid or expired.');
        }
      } finally {
        if (active) setPreparing(false);
      }
    };
    void prepareRecovery();
    return () => { active = false; };
  }, []);

  const updatePassword = async () => {
    if (password.length < 6) {
      setIsError(true);
      setMessage('Use at least 6 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setIsError(true);
      setMessage('The passwords do not match.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setIsError(false);
      setMessage('Your password has been updated.');
    } catch (error: any) {
      setIsError(true);
      setMessage(error.message || 'Could not update your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.secondary }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Choose a new password</Text>
        {preparing ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.secondary }]}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.background, borderColor: colors.secondary }]}
            />
            {message ? <Text style={[styles.message, { color: isError ? colors.danger : colors.primary }]}>{message}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }, saving && styles.disabled]}
              onPress={() => void updatePassword()}
              disabled={saving || !canReset}
            >
              {saving ? <ActivityIndicator color={colors.background} /> : <Text style={[styles.primaryText, { color: colors.background }]}>Update password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeButton} onPress={() => router.replace('/')}>
              <Text style={[styles.homeText, { color: colors.primary }]}>Return home</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 14, padding: 24, gap: 14 },
  title: { fontFamily: TYPOGRAPHY.heading, fontSize: 23, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, padding: 13, fontFamily: TYPOGRAPHY.body, fontSize: 16 },
  message: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 14, textAlign: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  disabled: { opacity: 0.65 },
  primaryText: { fontFamily: TYPOGRAPHY.heading, fontSize: 16 },
  homeButton: { alignItems: 'center', paddingVertical: 8 },
  homeText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 15 },
});
