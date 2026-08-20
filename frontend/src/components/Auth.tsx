import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase'; // Import your client
import { COLORS, TYPOGRAPHY, SPACING } from '../theme'; 

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Check your email!', 'Please check your email for the confirmation link.');
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        onChangeText={(text) => setEmail(text)}
        value={email}
        placeholder="email@address.com"
        autoCapitalize={'none'}
        style={styles.input}
      />
      
      <Text style={styles.label}>Password</Text>
      <TextInput
        onChangeText={(text) => setPassword(text)}
        value={password}
        secureTextEntry={true}
        placeholder="Password"
        autoCapitalize={'none'}
        style={styles.input}
      />

      {loading ? (
        <ActivityIndicator size="small" color="#5D4037" />
      ) : (
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.buttonPrimary} onPress={signInWithEmail}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonSecondary} onPress={signUpWithEmail}>
            <Text style={styles.buttonTextSecondary}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20 },
  label: { fontSize: 14, color: '#5D4037', marginBottom: 5, fontFamily: 'Poppins-Regular' },
  input: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontFamily: TYPOGRAPHY.body,
  },
  buttonGroup: { gap: 10 },
  buttonPrimary: { backgroundColor: '#5D4037', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#5D4037' },
  buttonText: { color: '#FFF', fontWeight: '600', fontFamily: TYPOGRAPHY.body},
  buttonTextSecondary: { color: '#5D4037', fontWeight: '600', fontFamily: TYPOGRAPHY.body },
});