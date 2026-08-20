import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from 'expo-router';
import {Feather} from '@expo/vector-icons';
import { COLORS, getShadowStyle, TYPOGRAPHY, SPACING } from '../../src/theme';
import { fetchPublicRecipes, fetchRecipes } from '../../src/api';
import { RecipeResponse } from '../../src/types'; // <-- Add this!
import { AppColors, usePreferences } from '../../src/contexts/PreferencesContext';
import { createThemedStyles } from '../../src/theme/createThemedStyles';
import { matchesCategory } from '../../src/categories';
import RecipeGrid from '../../src/components/RecipeGrid';

export default function CategoryScreen() {
  // 1. Grab the exact category name from the route (e.g., "Breakfast" or "Summer")
  const { name, scope } = useLocalSearchParams<{ name: string; scope?: 'vault' | 'community' }>();
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);

// 1. Force state to accept RecipeResponse objects
const [filteredRecipes, setFilteredRecipes] = useState<RecipeResponse[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState('');

const safeName = String(name || 'Popular');
const activeScope = scope === 'vault' ? 'vault' : 'community';

useFocusEffect(
  useCallback(() => {
    async function fetchCategoryData() {
      setIsLoading(true);
      setLoadError('');
      try {
        const allRecipes = activeScope === 'vault' ? await fetchRecipes() : await fetchPublicRecipes();

        const matched = allRecipes.filter(
          (recipe: RecipeResponse) => matchesCategory(recipe, safeName)
        );
        
        setFilteredRecipes(matched);
      } catch (error) {
        console.error(`Failed to load recipes for ${name}:`, error);
        setFilteredRecipes([]);
        setLoadError('Recipes in this category could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCategoryData();
  }, [activeScope, name])
);

  return (
    <View style={styles.container}>
      {/* Dynamic Header */}
      <Stack.Screen options={{ title: safeName }} />
  
      {/* NEW: The centering wrapper for desktop */}
      <View style={styles.contentContainer}>
        
        {/* 1. Back Button */}
        <View style={styles.actionArea}>
          <TouchableOpacity 
                      onPress={() => {
                        if (router.canGoBack()) {
            
                            router.back();
                          
                          } else {
                          
                            router.replace('/');
                          
                          }} 
                      }
            style={styles.backButtonFilled}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color={COLORS.primary} />
            <Text style={styles.backTextFilled}>Back</Text>
          </TouchableOpacity>
        </View>
  
        {/* 2. Page Title (Changed from ScrollView to View) */}
        <View style={styles.content}>
          <Text style={styles.pageTitle}>{safeName}</Text>
          <Text style={styles.subtitle}>{activeScope === 'vault' ? 'Recipes in My Vault' : 'Recipes shared by the Community'}</Text>
        </View>
  
        {/* 3. The FlatList */}
        {isLoading ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <RecipeGrid
            recipes={filteredRecipes}
            scope={activeScope === 'vault' ? 'vault' : 'community'}
            contentContainerStyle={styles.listContainer}
            emptyComponent={
              <Text style={styles.emptyText}>
                {loadError || `No ${safeName} recipes found in ${activeScope === 'vault' ? 'My Vault' : 'Community'}.`}
              </Text>
            }
          />
        )}
        
      </View>
    </View>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  loader: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  contentContainer: { // <-- YOUR NEW ADDITION
    flex: 1,
    width: '100%',
    maxWidth: 1250, 
    alignSelf: 'center', 
  },

  listContainer: { paddingTop: SPACING.sm },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 40, 
    fontSize: 16, 
    color: COLORS.textSecondary,
    fontFamily: TYPOGRAPHY.body,
  },
  actionArea: { 
    paddingHorizontal: SPACING.lg, 
    paddingTop: SPACING.lg, // Gives it some breathing room from the Header
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start', // Keeps it locked to the left
  },
  content: { padding: SPACING.lg },
  pageTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 32, color: COLORS.textPrimary, marginBottom: SPACING.md },
  subtitle: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary },
  backButtonFilled: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface, // Uses your off-white/tan surface color
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20, // Makes it a nice rounded pill shape
    borderWidth: 1,
    borderColor: COLORS.secondary, // Gives it a crisp edge using your tan color
    gap: SPACING.xs, // Spaces the icon and text
    
    // Optional: Add a tiny shadow so it pops off the background
    ...getShadowStyle('subtle'),
  },
  backTextFilled: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary, // Dark brown text for contrast
    marginTop: 2, // Slight optical alignment adjustment for the Poppins font
  },
}, textScale);
