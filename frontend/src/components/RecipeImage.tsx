import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';

import { usePreferences } from '../contexts/PreferencesContext';
import { SPACING } from '../theme';
import { supabase } from '../services/supabase';

type RecipeImageProps = {
  uri?: string | null;
  title: string;
  variant?: 'card' | 'hero';
};

export default function RecipeImage({ uri, title, variant = 'card' }: RecipeImageProps) {
  const { colors } = usePreferences();
  const [failed, setFailed] = useState(false);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | undefined>();

  useEffect(() => setFailed(false), [uri]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthHeaders(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : undefined));
  }, []);

  const containerStyle = variant === 'hero' ? styles.hero : styles.card;
  if (!uri || failed) {
    return (
      <View style={[containerStyle, styles.fallback, { backgroundColor: colors.surface, borderColor: colors.secondary }]} accessibilityLabel={`No image available for ${title}`}>
        <Feather name="image" size={variant === 'hero' ? 42 : 28} color={colors.secondary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri, headers: authHeaders }}
      style={containerStyle}
      contentFit="cover"
      transition={180}
      cachePolicy="memory-disk"
      accessibilityLabel={`${title} recipe`}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  card: { height: 150, marginHorizontal: -SPACING.md, marginTop: -SPACING.md, marginBottom: SPACING.md, borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: 'hidden' },
  hero: { width: '100%', height: 340, borderRadius: 18, marginBottom: SPACING.lg, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
