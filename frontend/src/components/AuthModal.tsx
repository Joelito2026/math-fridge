import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather, FontAwesome } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getShadowStyle, TYPOGRAPHY } from '../theme'; 
import { AppColors, usePreferences } from '../contexts/PreferencesContext';
import { createThemedStyles } from '../theme/createThemedStyles';
import { getAuthRedirectUrl, signInWithSocialProvider, type SocialAuthProvider } from '../services/socialAuth';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AuthModal({ visible, onClose }: AuthModalProps) {
  const { colors, textScale, isDark, highContrast, reduceMotion } = usePreferences();
  const styles = createStyles(colors, textScale, isDark, highContrast);
  const [name, setName] = useState(''); // NEW: Name state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialAuthProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState(''); // NEW: Error state
  const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';
  const appleAuthEnabled = process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === 'true';
  const controlsDisabled = loading || socialLoading !== null;
  const googleContentColor = isDark ? '#E8EAED' : '#1F1F1F';

  // Web-safe alert function
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  async function handleAuth() {
    setErrorMessage(''); // Clear previous errors
    setLoading(true);
    
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (!data.session) {
          showAlert('Check your email', 'We sent you a confirmation link. Open it to finish creating your account.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      
      handleCancel(); 

    } catch (error: any) {
      
      // Friendly error mapping
      let displayMessage = error.message;
      if (error.message === 'Invalid login credentials') {
        displayMessage = 'Incorrect email or password. Please try again.';
      } else if (error.message.includes('User already registered')) {
        displayMessage = 'An account with this email already exists. Try logging in instead.';
      } else if (error.message.includes('Password should be')) {
        displayMessage = 'Your password is too weak. Please use at least 6 characters.';
      }

      setErrorMessage(displayMessage); // Show the error on the UI
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Enter your email address first, then choose Forgot password.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl('auth/reset-password'),
      });
      if (error) throw error;
      showAlert('Check your email', 'We sent you a secure link to choose a new password.');
    } catch (error: any) {
      setErrorMessage(error.message || 'Could not send the password reset email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialAuth(provider: SocialAuthProvider) {
    setErrorMessage('');
    setSocialLoading(provider);
    try {
      const result = await signInWithSocialProvider(provider);
      if (result.completed) handleCancel();
    } catch (error: any) {
      setErrorMessage(error.message || `Could not sign in with ${provider === 'apple' ? 'Apple' : 'Google'}.`);
    } finally {
      setSocialLoading(null);
    }
  }

  function handleCancel() {
    setIsSignUp(false);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setSocialLoading(null);
    setErrorMessage(''); // Clear error on close
    onClose();
  }

  return (
    <Modal visible={visible} animationType={reduceMotion ? 'none' : 'fade'} transparent={true} onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalContent} accessibilityViewIsModal>
          <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
          
          {/* NEW: Show Name input only during Sign Up */}
          {isSignUp && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput 
                value={name} 
                onChangeText={setName} 
                style={styles.input} 
                placeholder="How should we call you?"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput 
              value={email} 
              onChangeText={setEmail} 
              style={styles.input} 
              autoCapitalize="none" 
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput 
                value={password} 
                onChangeText={setPassword} 
                style={styles.passwordInput} 
                secureTextEntry={!showPassword} 
                autoCapitalize="none"
                placeholder="Your password"
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {!isSignUp ? (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => void handleForgotPassword()}
                disabled={controlsDisabled}
                accessibilityRole="button"
                accessibilityLabel="Reset forgotten password"
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        {/* NEW: Render the red error message if it exists */}
        {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
          {googleAuthEnabled || appleAuthEnabled ? <View style={styles.socialSection}>
            <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>or continue with</Text><View style={styles.divider} /></View>
            {googleAuthEnabled ? <TouchableOpacity
              style={[styles.socialButton, styles.googleButton, controlsDisabled && styles.controlDisabled]}
              onPress={() => void handleSocialAuth('google')}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              accessibilityHint="Signs in using your Google account"
              accessibilityState={{ disabled: controlsDisabled, busy: socialLoading === 'google' }}
            >
              {socialLoading === 'google' ? <ActivityIndicator color={googleContentColor} /> : <><FontAwesome name="google" size={20} color="#4285F4" /><Text style={styles.googleButtonText}>Continue with Google</Text></>}
            </TouchableOpacity> : null}
            {appleAuthEnabled ? <TouchableOpacity
              style={[styles.socialButton, styles.appleButton, controlsDisabled && styles.controlDisabled]}
              onPress={() => void handleSocialAuth('apple')}
              disabled={controlsDisabled}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
              accessibilityState={{ disabled: controlsDisabled, busy: socialLoading === 'apple' }}
            >
              {socialLoading === 'apple' ? <ActivityIndicator color="#FFFFFF" /> : <><FontAwesome name="apple" size={22} color="#FFFFFF" /><Text style={styles.appleButtonText}>Continue with Apple</Text></>}
            </TouchableOpacity> : null}
          </View> : null}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.flexButton, styles.primaryButton, controlsDisabled && styles.controlDisabled]} onPress={handleAuth} disabled={controlsDisabled}>
              {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>{isSignUp ? 'Sign Up' : 'Login'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.flexButton, styles.cancelButton, controlsDisabled && styles.controlDisabled]} onPress={handleCancel} disabled={controlsDisabled}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        
          <TouchableOpacity 
            style={styles.toggleTextContainer} 
            onPress={() => { setIsSignUp(!isSignUp); setErrorMessage(''); }}
          >
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: AppColors, textScale: number, isDark: boolean, highContrast: boolean) => createThemedStyles({
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, padding: 24, borderRadius: 12, ...getShadowStyle('elevated') },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 20 , fontFamily: TYPOGRAPHY.bodyMedium},
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.body },
  input: { borderWidth: 1, borderColor: COLORS.secondary, color: COLORS.textPrimary, padding: 12, borderRadius: 8, backgroundColor: COLORS.background, fontFamily: TYPOGRAPHY.body },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 8, backgroundColor: COLORS.background },
  passwordInput: { flex: 1, padding: 12, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.body},
  eyeIcon: { padding: 12 },
  forgotPasswordButton: { alignSelf: 'flex-end', paddingTop: 8, paddingVertical: 4 },
  forgotPasswordText: { color: COLORS.primary, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  flexButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { backgroundColor: COLORS.primary },
  cancelButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.secondary },
  primaryButtonText: { color: COLORS.background, fontWeight: 'bold', fontSize: 16, fontFamily: TYPOGRAPHY.body },
  cancelButtonText: { color: COLORS.textPrimary, fontWeight: '500', fontSize: 16 , fontFamily: TYPOGRAPHY.body},
  toggleTextContainer: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: COLORS.primary, fontWeight: '500', fontSize: 14 , fontFamily: TYPOGRAPHY.body},
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
    fontSize: 14, 
    fontFamily: TYPOGRAPHY.body
  },
  socialSection: { gap: 10, marginBottom: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.secondary },
  dividerText: { color: COLORS.textSecondary, fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  socialButton: { minHeight: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  googleButton: { backgroundColor: isDark ? '#131314' : '#FFFFFF', borderColor: highContrast ? COLORS.textPrimary : (isDark ? '#8E918F' : '#747775'), borderWidth: highContrast ? 2 : 1 },
  googleButtonText: { flexShrink: 1, textAlign: 'center', color: isDark ? '#E8EAED' : '#1F1F1F', fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 15, lineHeight: 21 },
  appleButton: { backgroundColor: isDark ? COLORS.background : '#000000', borderColor: highContrast ? COLORS.textPrimary : '#747775', borderWidth: highContrast ? 2 : 1 },
  appleButtonText: { color: '#FFFFFF', fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 15 },
  controlDisabled: { opacity: 0.58 },
}, textScale);
