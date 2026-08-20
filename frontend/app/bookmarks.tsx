import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { fetchBookmarkedRecipes } from '../src/api';
import { RecipeResponse } from '../src/types';
import { COLORS, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
import RecipeImage from '../src/components/RecipeImage';

export default function BookmarksScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  const [bookmarks, setBookmarks] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadBookmarks = async () => {
        setLoading(true);
        const data = await fetchBookmarkedRecipes();
        setBookmarks(data);
        setLoading(false);
      };
      loadBookmarks();
    }, [])
  );

  const renderCard = ({ item }: { item: RecipeResponse }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.7} 
      onPress={() => router.push(`/${item.id}`)}
    >
      <RecipeImage uri={item.image_url} title={item.title} />
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      
      <Text style={styles.publisherName}>By {item.author_name}</Text>
      
      <Text style={styles.cardDetail}>
        Prep: {item.recipe_data?.prep_time_minutes || 0}m • Cook: {item.recipe_data?.cook_time_minutes || 0}m
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* --- NEW: Wrapper for Side Margins & Desktop constraints --- */}
      <View style={styles.contentContainer}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Bookmarks</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            numColumns={3}
            key={3}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <Text style={styles.emptyText}>You haven't bookmarked any community recipes yet.</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  
  // --- ADDED: contentContainer to match index.tsx exactly ---
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1250,
    alignSelf: 'center',
  },
  
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: SPACING.lg, // Aligns perfectly with the grid padding
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md
  },
  backButton: { padding: SPACING.xs },
  headerTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 22, color: COLORS.textPrimary }, // Synced to size 22
  
  listContainer: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  row: { flex: 1, justifyContent: 'flex-start', gap: SPACING.md },
  
  card: { 
    flex: 1, 
    maxWidth: '32%', 
    backgroundColor: COLORS.surface, 
    padding: SPACING.md, 
    borderRadius: 12, 
    marginBottom: SPACING.md, 
    shadowColor: COLORS.textPrimary, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 2 
  },
  
  // Synced fontSize from 16 to 18 to match index.tsx
  cardTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 18, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  
  publisherName: {
    fontFamily: TYPOGRAPHY.bodyMedium,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  
  cardDetail: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary },
  emptyText: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
}, textScale);
