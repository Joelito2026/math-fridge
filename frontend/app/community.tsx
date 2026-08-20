// app/community.tsx
import { useFocusEffect, useRouter, Stack } from 'expo-router'; // or 'expo-router'
import { useCallback, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  TextInput, 
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { fetchPublicRecipes } from '../src/api'; 
import { RecipeResponse } from '../src/types';
import { COLORS, getShadowStyle, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
import { DIETARY_FILTERS } from '../src/dietary';
import RecipeGrid from '../src/components/RecipeGrid';

export default function CommunityScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedDietaryTags, setSelectedDietaryTags] = useState<string[]>([]);
  const requestId = useRef(0);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Logic
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDietaryTags = selectedDietaryTags.every((tag) => recipe.dietary_tags?.includes(tag));
    return matchesSearch && matchesDietaryTags;
  });

  const loadPublicRecipes = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchPublicRecipes();
      if (currentRequest === requestId.current) setRecipes(data || []);
    } catch (error) {
      console.error(error);
      if (currentRequest === requestId.current) {
        setRecipes([]);
        setLoadError('Community recipes could not be loaded. Check your connection and try again.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  const toggleDietaryTag = (tag: string) => {
    setSelectedDietaryTags((current) => current.includes(tag)
      ? current.filter((selected) => selected !== tag)
      : [...current, tag]);
  };

  useFocusEffect(
    useCallback(() => {
      void loadPublicRecipes();
    }, [loadPublicRecipes])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <Stack.Screen options={{ title: 'Community Feed' }} />
      
      <View style={styles.contentContainer}>
        
        {/* The Action Area / Back Button */}
        <View style={styles.actionArea}>
          <TouchableOpacity 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            }} 
            style={styles.backButtonFilled}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={COLORS.primary} />
            <Text style={styles.backTextFilled}>Home</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.pageTitle}>Community Feed</Text>
          <Text style={styles.subtitle}>Discover AI-formatted recipes shared by others.</Text>
        </View>

        {/* The Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search public recipes..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
              <Feather name="x-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterSection}>
          <View style={styles.filterHeadingRow}>
            <Text style={styles.filterTitle}>Dietary filters</Text>
            {selectedDietaryTags.length > 0 ? (
              <TouchableOpacity onPress={() => setSelectedDietaryTags([])} accessibilityRole="button" accessibilityLabel="Clear dietary filters">
                <Text style={styles.clearFilters}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            accessibilityRole="list"
          >
            {DIETARY_FILTERS.map(({ label, emoji }) => {
              const selected = selectedDietaryTags.includes(label);
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.filterChip, selected && styles.filterChipSelected]}
                  onPress={() => toggleDietaryTag(label)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${label} filter`}
                >
                  {selected ? <Feather name="check" size={14} color={COLORS.background} /> : null}
                  <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{emoji} {label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.filterHint}>AI-generated tags help discovery, but always verify ingredients for allergies. Multiple selections must all match.</Text>
        </View>

        {/* The Recipe List */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <RecipeGrid
            recipes={filteredRecipes}
            scope="community"
            contentContainerStyle={styles.listContainer}
            emptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{loadError || (selectedDietaryTags.length ? 'No recipes match all selected dietary filters.' : 'No public recipes found. Be the first to share one!')}</Text>
                {loadError ? <TouchableOpacity style={styles.retryButton} onPress={() => void loadPublicRecipes()} accessibilityRole="button"><Text style={styles.retryText}>Try Again</Text></TouchableOpacity> : null}
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1250, 
    alignSelf: 'center', 
  },
  actionArea: { 
    paddingHorizontal: SPACING.lg, 
    paddingTop: SPACING.lg, 
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start', 
  },
  backButtonFilled: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface, 
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: COLORS.secondary, 
    gap: SPACING.xs, 
    ...getShadowStyle('subtle'),
  },
  backTextFilled: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary, 
    marginTop: 2, 
  },
  headerTitleContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  pageTitle: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 32, 
    color: COLORS.textPrimary, 
  },
  subtitle: { 
    fontFamily: TYPOGRAPHY.body, 
    fontSize: 16, 
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  listContainer: { paddingTop: SPACING.md },
  emptyState: { alignItems: 'center', marginTop: SPACING.xl },
  emptyText: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  retryButton: { minHeight: 44, justifyContent: 'center', marginTop: SPACING.md, borderRadius: 22, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg },
  retryText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.background },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    height: 50,
    ...getShadowStyle('subtle'),
  },
  searchIcon: { marginRight: SPACING.sm },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: '100%',
  },
  clearIcon: { padding: SPACING.xs, marginLeft: SPACING.sm },
  filterSection: { marginTop: SPACING.md },
  filterHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  filterTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: COLORS.textPrimary },
  clearFilters: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: COLORS.primary, paddingVertical: SPACING.xs },
  filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  filterChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: 20, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md },
  filterChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: COLORS.textPrimary },
  filterChipTextSelected: { color: COLORS.background },
  filterHint: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary, paddingHorizontal: SPACING.lg, marginTop: SPACING.xs },
}, textScale);
