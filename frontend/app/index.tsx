import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  ScrollView,
  TextInput, // <-- New import
  TouchableOpacity, // <-- New import (a button that fades when pressed)
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteRecipe, fetchRecipes, extractAndSaveRecipe , fetchPublicRecipes} from '../src/api'; // <-- Import the new POST function
import { RecipeResponse } from '../src/types';
import { COLORS, getShadowStyle, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
import { Feather } from '@expo/vector-icons';

// --- NEW IMPORTS ---
import { supabase } from '../src/services/supabase';
import { User } from '@supabase/supabase-js';
import AuthModal from '../src/components/AuthModal';
import RecipeGrid from '../src/components/RecipeGrid';

const CATEGORY_ORDER = [
  'Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Dessert', 'Soup', 'Bread',
  'Vegetables', 'Poultry', 'Meat', 'Pork', 'Drinks', 'Popular',
];

export default function HomeScreen() {
  const router = useRouter(); // <-- Add this line right above your state variables
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  const [recipes, setRecipes] = useState<RecipeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- New State for the Input Bar ---
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  // --- NEW: Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // --- NEW: AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecipeResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [activeTab, setActiveTab] = useState<'community' | 'personal'>(tab === 'personal' ? 'personal' : 'community');

  useEffect(() => {
    if (tab === 'personal') setActiveTab('personal');
  }, [tab]);


  // --- NEW: LISTEN FOR LOGIN/LOGOUT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        // INSTANTLY clear the screen if they sign out!
        setRecipes([]); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const categoryCounts = useMemo(() => recipes.reduce<Record<string, number>>((counts, recipe) => {
    const category = recipe.category?.trim() || 'Popular';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {}), [recipes]);

  const availableCategories = useMemo(() => Object.keys(categoryCounts).sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left);
    const rightIndex = CATEGORY_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  }), [categoryCounts]);

  const filteredRecipes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return recipes.filter((recipe) => {
      const matchesSearch = !normalizedSearch || recipe.title.toLowerCase().includes(normalizedSearch);
      const matchesCategory = selectedCategory === 'All' || (recipe.category?.trim() || 'Popular') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [recipes, searchQuery, selectedCategory]);

  useEffect(() => {
    setSelectedCategory('All');
  }, [activeTab]);

  // 3. Update loadRecipes to fetch based on the active tab:
  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'community') {
        // Fetch public recipes (No login required!)
        const data = await fetchPublicRecipes();
        setRecipes(data);
      } else {
        // Fetch personal recipes (Login required!)
        if (!user) {
          setRecipes([]);
          setLoading(false);
          return;
        }
        const data = await fetchRecipes();
        setRecipes(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]); // <-- Ensure activeTab is in this dependency array!
  // --- ADD THIS MISSING TRIGGER ---
  // This runs loadRecipes automatically when the app opens, 
  // when you switch tabs, or when you come back from a recipe page!
  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [loadRecipes])
  );
  const handleExtract = async () => {
    // --- NEW: REQUIRE LOGIN TO EXTRACT ---
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!urlInput.trim()) return; 
    
    setIsExtracting(true);
    try {
      await extractAndSaveRecipe(urlInput, 1.0); 
      setUrlInput(''); 
      await loadRecipes(); 
    } catch (error) {
      alert("Failed to extract recipe. Check the console.");
    } finally {
      setIsExtracting(false);
    }
  };

  const requestDelete = useCallback((recipe: RecipeResponse) => {
    setDeleteError('');
    setDeleteTarget(recipe);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteRecipe(deleteTarget.id);
      setRecipes((current) => current.filter((recipe) => recipe.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error: any) {
      setDeleteError(error.message || 'Could not delete this recipe. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting]);

  if (loading && recipes.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
    {/* 1. The Global Branding Header */}

    {/* --- NEW: Wrapper for Side Margins --- */}
    <View style={styles.contentContainer}>

      {/* 2. The Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput}
          placeholder="Search your recipes..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {/* Shows a clear button only if there is text in the search bar */}
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
            <Feather name="x-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      

    {/* --- 3. The Section Header --- */}
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'community' && styles.activeTabButton]}
        onPress={() => { setActiveTab('community'); router.setParams({ tab: 'community' }); }}
        activeOpacity={0.7}
      >
        <Feather 
          name="globe" 
          size={16} 
          color={activeTab === 'community' ? COLORS.background : COLORS.textSecondary} 
        />
        <Text style={[styles.tabText, activeTab === 'community' && styles.activeTabText]}>
          Community
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.tabButton, activeTab === 'personal' && styles.activeTabButton]}
        onPress={() => { setActiveTab('personal'); router.setParams({ tab: 'personal' }); }}
        activeOpacity={0.7}
      >
        <Feather 
          name="lock" 
          size={16} 
          color={activeTab === 'personal' ? COLORS.background : COLORS.textSecondary} 
        />
        <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
          My Vault
        </Text>
      </TouchableOpacity>
    </View>

    <View style={styles.filterSection}>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Categories</Text>
        <Text style={styles.resultCount}>{filteredRecipes.length} {filteredRecipes.length === 1 ? 'recipe' : 'recipes'}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {['All', ...availableCategories].map((category) => {
          const isSelected = selectedCategory === category;
          const count = category === 'All' ? recipes.length : categoryCounts[category];
          return (
            <TouchableOpacity
              key={category}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setSelectedCategory(category)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Show ${category} recipes, ${count}`}
            >
              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{category}</Text>
              <View style={[styles.chipCount, isSelected && styles.chipCountSelected]}>
                <Text style={[styles.chipCountText, isSelected && styles.chipCountTextSelected]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>

      {activeTab === 'personal' && user && filteredRecipes.length > 0 ? (
        <View style={styles.swipeHint} accessibilityRole="text">
          <Feather name="chevrons-left" size={15} color={COLORS.textSecondary} />
          <Text style={styles.swipeHintText}>Swipe a recipe left to delete it</Text>
        </View>
      ) : null}

      {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <RecipeGrid
            recipes={filteredRecipes}
            scope={activeTab === 'community' ? 'community' : 'vault'}
            onDeleteRequest={activeTab === 'personal' ? requestDelete : undefined}
            contentContainerStyle={styles.listContainer}
            emptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                {recipes.length > 0 ? (
                  <Text style={styles.emptyText}>No recipes match the selected category and search.</Text>
                ) : activeTab === 'community' ? (
                  <Text style={styles.emptyText}>The community feed is quiet. Publish a recipe to start the trend!</Text>
                ) : !user ? (
                  <>
                    <Text style={styles.emptyText}>Sign in to view and save your private recipes.</Text>
                    <TouchableOpacity 
                      style={[styles.button, { marginTop: 20 }]} 
                      onPress={() => setShowAuthModal(true)}
                    >
                      <Text style={styles.buttonText}>Sign In</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.emptyText}>No private recipes saved yet. Time to scrape!</Text>
                )}
              </View>
            }
          />
        )}
      </View>
      
      <AuthModal 
        visible={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      <Modal
        visible={Boolean(deleteTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setDeleteTarget(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteDialog} accessibilityViewIsModal>
            <View style={styles.deleteDialogIcon}>
              <Feather name="trash-2" size={24} color={COLORS.danger} />
            </View>
            <Text style={styles.deleteDialogTitle}>Delete this recipe?</Text>
            <Text style={styles.deleteDialogText}>
              {deleteTarget ? `“${deleteTarget.title}” will be permanently removed from My Vault.` : ''}
            </Text>
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity
                style={styles.cancelDeleteButton}
                onPress={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, isDeleting && styles.buttonDisabled]}
                onPress={() => void confirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmDeleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  // ... (keep all your existing styles, and add these to the bottom)
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1250, // Locks the max width so it doesn't stretch infinitely
    alignSelf: 'center', // Centers the container, creating auto-margins on the sides
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  topHeader: { 
    backgroundColor: COLORS.primary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: SPACING.md 
  },
  headerLogoText: { 
    fontFamily: TYPOGRAPHY.logo, 
    fontSize: 42, 
    color: COLORS.secondary 
  },
  actionArea: { 
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md 
  },
  listContainer: {},
  swipeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACING.xs, paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  swipeHintText: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary },
  categoryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 999, paddingVertical: 3, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  categoryBadgeText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: COLORS.primary },
  emptyText: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xl },
  
  // --- NEW STYLES ---
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  button: {
    height: 48,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.background,
  },
  dashboardMenu: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md, // Puts perfect spacing between the two buttons
  },
  menuButton: {
    flex: 1, // Makes both buttons take up exactly 50% of the screen width
    height: 56,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    ...getShadowStyle('subtle'),
  },
  menuButtonOutline: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  menuButtonText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 16,
    color: COLORS.surface,
  },
  menuButtonTextOutline: {
    color: COLORS.primary,
  },
  urlDropzone: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Pushes title left, button right
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  // Add these two new styles right below it:
  communityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 4,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  activeTabButton: {
    backgroundColor: COLORS.primary, // Slurps up the primary color when active
  },
  tabText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.background,
  },
  filterSection: { marginBottom: SPACING.md },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  filterTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 16, color: COLORS.textPrimary },
  resultCount: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary },
  chipRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  filterChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: 19, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md },
  filterChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: COLORS.textPrimary },
  filterChipTextSelected: { color: COLORS.background },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 5 },
  chipCountSelected: { backgroundColor: COLORS.secondary },
  chipCountText: { fontFamily: TYPOGRAPHY.heading, fontSize: 10, color: COLORS.textSecondary },
  chipCountTextSelected: { color: COLORS.primary },
  communityButtonText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.primary,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    paddingHorizontal: SPACING.md,
    height: 50,
    ...getShadowStyle('subtle'),
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    height: '100%', // Ensures the touch target fills the container
  },
  clearIcon: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.overlay, padding: SPACING.lg },
  deleteDialog: { width: '100%', maxWidth: 420, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.surface, padding: SPACING.lg, ...getShadowStyle('elevated') },
  deleteDialogIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: COLORS.background, marginBottom: SPACING.md },
  deleteDialogTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 21, color: COLORS.textPrimary, textAlign: 'center' },
  deleteDialogText: { fontFamily: TYPOGRAPHY.body, fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm },
  deleteError: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: COLORS.danger, textAlign: 'center', marginTop: SPACING.md },
  deleteDialogActions: { width: '100%', flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelDeleteButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.background },
  cancelDeleteText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.textPrimary },
  confirmDeleteButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.danger },
  confirmDeleteText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: '#FFFFFF' },
}, textScale);
