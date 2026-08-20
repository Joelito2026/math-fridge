import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { browserAuthSessionCompletion, createSessionFromUrl } from '../../src/services/socialAuth';
import { usePreferences } from '../../src/contexts/PreferencesContext';
import { TYPOGRAPHY } from '../../src/theme';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { colors } = usePreferences();
  const params = useLocalSearchParams<{ error?: string; error_description?: string }>();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // The web popup has already posted its callback URL to the original app
    // window. Let that window create the session and allow this one to close.
    if (browserAuthSessionCompletion.type === 'success') return;

    let active = true;
    const finishSignIn = async () => {
      try {
        if (params.error || params.error_description) {
          throw new Error(params.error_description || params.error || 'Authentication failed.');
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (active) router.replace('/');
          return;
        }

        const callbackUrl = await Linking.getInitialURL();
        if (callbackUrl) await createSessionFromUrl(callbackUrl);
        const { data: refreshedData } = await supabase.auth.getSession();
        if (active && refreshedData.session) router.replace('/');
      } catch (error: any) {
        if (active) setErrorMessage(error.message || 'Could not complete sign-in.');
      }
    };
    void finishSignIn();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) router.replace('/');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [params.error, params.error_description, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {errorMessage ? (
        <>
          <Text style={[styles.errorTitle, { color: colors.danger }]}>Sign-in wasn’t completed</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{errorMessage}</Text>
          <Text style={[styles.link, { color: colors.primary }]} onPress={() => router.replace('/')}>Return home</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.textPrimary }]}>Completing sign-in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 22 },
  text: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
  link: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 16, textDecorationLine: 'underline' },
});
