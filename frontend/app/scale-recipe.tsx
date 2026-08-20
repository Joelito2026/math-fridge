import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TextInput, 
  TouchableOpacity,
  ScrollView,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Updated to match manual.tsx
import { Feather } from '@expo/vector-icons';

import { extractAndSaveRecipe, updateRecipe } from '../src/api'; // <-- Import the new function 
import { COLORS, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
// --- NEW IMPORTS ---
import { supabase } from '../src/services/supabase';
import { User } from '@supabase/supabase-js';
import AuthModal from '../src/components/AuthModal';
import RecipeImage from '../src/components/RecipeImage';

export default function ScaleRecipeScreen() {
  const router = useRouter(); 
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  
  const [urlInput, setUrlInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [recipeData, setRecipeData] = useState<any>(null);
  const [useSourceImage, setUseSourceImage] = useState(false);

  // --- NEW: AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // --- NEW: CHECK LOGIN STATUS ON MOUNT ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // NEW: State to track the ID and any errors when saving
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Helper to safely convert backend objects into readable text strings
  const formatIngredients = (ingredients: any) => {
    if (!ingredients || !Array.isArray(ingredients)) return '';
    
    return ingredients.map((ing) => {
      if (typeof ing === 'string') return ing;
      if (ing.quantity_fraction || ing.unit || ing.name) {
         return `${ing.quantity_fraction || ''} ${ing.unit || ''} ${ing.name || ''}`.trim();
      }
      return JSON.stringify(ing);
    }).join('\n');
  };

const handleExtract = async () => {
    setExtractError('');
    setRecipeData(null);
    setUseSourceImage(false);
    setRecipeId(null); // Clear previous IDs
    // --- NEW: THE UX BLOCKER ---
    if (!user) {
      setShowAuthModal(true);
      return; // Stop the function here so it doesn't hit the API
    }

    if (!urlInput.trim()) {
      setExtractError('Please enter a valid recipe URL.');
      return; 
    }
    
    setIsExtracting(true);
    try {
      const result = await extractAndSaveRecipe(urlInput, 1.0); 
      setRecipeData(result.data);
      setRecipeId(result.recipe_id); // <-- THIS is the key to linking the edits
    } catch (error: any) {
      setExtractError(error.message || "Failed to extract recipe.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Put this right below handleExtract
  const handleSave = async () => {
    setSaveError('');
    if (!recipeId) return;

    setIsSaving(true);
    try {
      await updateRecipe(recipeId, {
        title: recipeData.title,
        ingredients: recipeData.ingredients,
        instructions: recipeData.instructions,
        image_url: useSourceImage ? recipeData.image_url : null,
        image_source: recipeData.image_url ? 'extracted' : null,
        image_source_url: recipeData.image_url || null,
        image_attribution: recipeData.image_url ? `Image from ${new URL(urlInput).hostname}` : null,
        image_usage_confirmed: false,
      });
      router.push('/'); // Safely navigate home only after the database confirms the update
    } catch (error: any) {
      // Pushes the error directly to the UI, strictly avoiding console logging
      setSaveError(error.message); 
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <View style={styles.contentContainer}>
        
        {/* --- 1. The Functional Action Area (Mirrors manual.tsx) --- */}
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
            <Text style={styles.backTextFilled}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* --- 2. The Form Content Area --- */}
        <ScrollView contentContainerStyle={styles.content}>
          
          <Text style={styles.pageTitle}>Scale Recipe</Text>
          <Text style={styles.subtitle}>Paste a URL to extract and adjust yields.</Text>

          <View style={styles.urlDropzone}>
            <TextInput 
              style={[styles.input, { flex: 1, marginBottom: 0 }]} // Override margin for the inline layout
              placeholder="Paste a recipe URL here..."
              placeholderTextColor={COLORS.textSecondary}
              value={urlInput}
              onChangeText={(text) => {
                setUrlInput(text);
                setExtractError('');
              }}
              editable={!isExtracting}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={[styles.button, isExtracting && styles.buttonDisabled]} 
              onPress={handleExtract}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <Text style={styles.buttonText}>Scrape</Text>
              )}
            </TouchableOpacity>
          </View>

          {extractError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{extractError}</Text>
            </View>
          ) : null}

          {/* --- 3. POST-EXTRACTION EDIT VIEW --- */}
          {recipeData && (
            <View style={styles.editorContainer}>
              <Text style={styles.successText}>Extraction Successful!</Text>

              {recipeData.image_url ? <View style={styles.sourceImageCard}>
                <RecipeImage uri={recipeData.image_url} title={recipeData.title || 'Extracted recipe'} variant="hero" />
                <View style={styles.sourceImageRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Use source website image</Text>
                    <Text style={styles.imageEthicsText}>Optional for your private recipe. It remains attributed to the original website and requires permission confirmation before Community publishing.</Text>
                  </View>
                  <Switch value={useSourceImage} onValueChange={setUseSourceImage} trackColor={{ false: COLORS.secondary, true: COLORS.primary }} thumbColor={COLORS.surface} accessibilityLabel="Use source website image" />
                </View>
              </View> : null}
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Title</Text>
                <TextInput 
                  style={styles.input} 
                  value={recipeData.title} 
                  onChangeText={(text) => setRecipeData({...recipeData, title: text})}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Ingredients (One per line)</Text>
                <TextInput 
                  style={[styles.input, styles.textArea]} 
                  multiline
                  value={formatIngredients(recipeData.ingredients)} 
                  onChangeText={(text) => setRecipeData({...recipeData, ingredients: text.split('\n')})}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Instructions (One per line)</Text>
                <TextInput 
                  style={[styles.input, styles.textArea]} 
                  multiline
                  value={recipeData.instructions?.join('\n')} 
                  onChangeText={(text) => setRecipeData({...recipeData, instructions: text.split('\n')})}
                />
              </View>
              
              {/* Display saving errors cleanly on the UI */}
              {saveError ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{saveError}</Text>
                </View>
              ) : null}

              <TouchableOpacity 
                style={[styles.saveButton, isSaving && styles.buttonDisabled]}
                onPress={handleSave} // <-- Hook up the new logic here
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={COLORS.surface} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Recipe</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {/* --- NEW: RENDER THE MODAL --- */}
          <AuthModal 
            visible={showAuthModal} 
            onClose={() => setShowAuthModal(false)} 
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  sourceImageCard: { marginBottom: SPACING.lg },
  sourceImageRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  imageEthicsText: { fontFamily: TYPOGRAPHY.body, fontSize: 12, lineHeight: 18, color: COLORS.textSecondary, marginTop: SPACING.xs },
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1250, 
    alignSelf: 'center', 
  },
  
  // --- SHARED STYLES (Mirrored from manual.tsx) ---
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
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  backTextFilled: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary, 
    marginTop: 2, 
  },
  content: { 
    padding: SPACING.lg 
  },
  pageTitle: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 32, 
    color: COLORS.textPrimary, 
    marginBottom: SPACING.md 
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontFamily: TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.xl,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.surface,
  },

  // --- SCREEN SPECIFIC STYLES ---
  urlDropzone: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    marginBottom: SPACING.md,
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
  errorContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.body,
    color: COLORS.danger,
    fontSize: 14,
  },
  editorContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    marginTop: SPACING.sm,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  successText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.success,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  textArea: {
    height: 'auto',
    minHeight: 120,
    paddingTop: SPACING.md, 
    paddingBottom: SPACING.md,
    textAlignVertical: 'top', 
  },
}, textScale);
