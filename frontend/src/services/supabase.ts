import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// 1. Load variables (using fallback to ensure we don't crash immediately)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// 2. Strict validation
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase variables. Ensure .env has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

// 3. Platform-aware storage logic
// We set 'storage' to 'undefined' on Web so Supabase uses standard localStorage
// We set 'storage' to SecureStore ONLY on Android/iOS
const storage = Platform.OS === 'web' ? undefined : {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// 4. Initialize
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});