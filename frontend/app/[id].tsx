import { useState, useEffect } from 'react';
import { Alert, Linking, View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteRecipe, fetchRecipeById, fetchRecipeTagSuggestions, updateRecipe, togglePublishStatus, bookmarkRecipe } from '../src/api';
import AuthModal from '../src/components/AuthModal'; // <-- Add this
import { IngredientItem, RecipeResponse } from '../src/types';
import { COLORS, TYPOGRAPHY, SPACING } from '../src/theme';
import { Feather } from '@expo/vector-icons';
// 1. Add the user state (if it isn't there already)
import { supabase } from '../src/services/supabase';
import { User } from '@supabase/supabase-js';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
import RecipeImage from '../src/components/RecipeImage';
import { DIETARY_FILTERS } from '../src/dietary';
import RecipeTagEditor from '../src/components/RecipeTagEditor';
import TargetYieldSlider from '../src/components/TargetYieldSlider';
import { formatEditableQuantity, formatEquivalentMeasurement, formatScaledQuantity, getAtomicMultiplier, getBaseQuantity, getScalingType, normalizeManualAmount, parseQuantity, scalingTypeLabel } from '../src/scaling';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  
  // New state to hold the specific recipe
  const [recipe, setRecipe] = useState<RecipeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImageRightsConfirm, setShowImageRightsConfirm] = useState(false);
  const [showDietaryReview, setShowDietaryReview] = useState(false);
  const [dietaryDraft, setDietaryDraft] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState<string[]>([]);
  const [targetYield, setTargetYield] = useState(1);
  const [overrideIngredientIndex, setOverrideIngredientIndex] = useState<number | null>(null);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [isSavingOverride, setIsSavingOverride] = useState(false);
  const [isTogglingPublish, setIsTogglingPublish] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  // 2. Listen for the logged-in user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);


  // Fetch the data when the screen opens
  useEffect(() => {
    const loadRecipe = async () => {
      if (typeof id === 'string') {
        const data = await fetchRecipeById(id);
        setRecipe(data);
        if (data) setTargetYield(Number(data.target_yield) || 1);
      }
      setLoading(false);
    };
    loadRecipe();
  }, [id]);

  const handleDelete = async () => {
    if (typeof id !== 'string') return;
    setIsDeleting(true);
    try {
      await deleteRecipe(id);
      setShowDeleteConfirm(false);
      router.replace('/');
    } catch (error: any) {
      setShowDeleteConfirm(false);
      Alert.alert('Could not delete recipe', error.message || 'Please try again.');
      setIsDeleting(false);
    }
  };
  
  const handleBookmark = async () => {
    if (!user) {
      setShowAuthModal(true); // Require login!
      return;
    }

    setIsBookmarking(true);
    try {
      await bookmarkRecipe(recipe!.id);
      alert("Saved to Bookmarks!"); // <-- Changed this alert text!
    } catch (error) {
      alert("Failed to bookmark recipe.");
    } finally {
      setIsBookmarking(false);
    }
  };


  const handlePublishToggle = async () => {
    if (!recipe) return;
    if (!recipe.is_public) {
      let dietarySuggestions = recipe.dietary_tags || [];
      let categorySuggestions = recipe.category_tags?.length ? recipe.category_tags : [];
      if (!categorySuggestions.length) {
        setIsTogglingPublish(true);
        try {
          const suggestions = await fetchRecipeTagSuggestions(recipe.id);
          categorySuggestions = suggestions.category_tags;
          if (!dietarySuggestions.length) dietarySuggestions = suggestions.dietary_tags;
        } catch {
          categorySuggestions = [recipe.category || 'Popular'];
        } finally {
          setIsTogglingPublish(false);
        }
      }
      setDietaryDraft(dietarySuggestions);
      setCategoryDraft(categorySuggestions.length ? categorySuggestions : [recipe.category || 'Popular']);
      setShowDietaryReview(true);
      return;
    }
    setIsTogglingPublish(true);
    try {
      await togglePublishStatus(recipe.id, false);
      setRecipe({ ...recipe, is_public: false });
    } catch (error: any) {
      Alert.alert('Could not update status', error.message || 'Please try again.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const publishAfterDietaryReview = async () => {
    if (!recipe) return;
    setShowDietaryReview(false);
    if (recipe.image_url && !recipe.image_usage_confirmed) {
      setShowImageRightsConfirm(true);
      return;
    }
    setIsTogglingPublish(true);
    try {
      await togglePublishStatus(recipe.id, true, dietaryDraft, categoryDraft);
      setRecipe({ ...recipe, is_public: true, dietary_tags: dietaryDraft, category_tags: categoryDraft, category: categoryDraft.includes(recipe.category) ? recipe.category : (categoryDraft[0] || 'Popular') });
    } catch (error: any) {
      Alert.alert('Could not publish recipe', error.message || 'Please try again.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const publishAfterImageDecision = async (keepImage: boolean) => {
    if (!recipe) return;
    setIsTogglingPublish(true);
    try {
      await updateRecipe(recipe.id, {
        title: recipe.title,
        prep_time_minutes: recipe.recipe_data.prep_time_minutes ?? 0,
        cook_time_minutes: recipe.recipe_data.cook_time_minutes ?? 0,
        ingredients: recipe.recipe_data.ingredients,
        instructions: recipe.recipe_data.instructions,
        image_url: keepImage ? recipe.image_url : null,
        image_source: keepImage ? recipe.image_source : null,
        image_source_url: recipe.image_source_url,
        image_attribution: recipe.image_attribution,
        image_usage_confirmed: keepImage,
        dietary_tags: dietaryDraft,
        category_tags: categoryDraft,
      });
      await togglePublishStatus(recipe.id, true, dietaryDraft, categoryDraft);
      setRecipe({ ...recipe, is_public: true, dietary_tags: dietaryDraft, category_tags: categoryDraft, category: categoryDraft.includes(recipe.category) ? recipe.category : (categoryDraft[0] || 'Popular'), image_url: keepImage ? recipe.image_url : null, image_source: keepImage ? recipe.image_source : null, image_usage_confirmed: keepImage });
      setShowImageRightsConfirm(false);
    } catch (error: any) {
      Alert.alert('Could not publish recipe', error.message || 'Please try again.');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const openOverrideEditor = (ingredient: IngredientItem, index: number) => {
    const multiplier = getAtomicMultiplier(recipe?.recipe_data.ingredients ?? [], targetYield);
    setOverrideIngredientIndex(index);
    setOverrideAmount(formatEditableQuantity(getBaseQuantity(ingredient) * multiplier));
    setOverrideError('');
  };

  const saveOverride = async () => {
    if (!recipe || overrideIngredientIndex === null) return;

    const enteredAmount = parseQuantity(overrideAmount);
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      setOverrideError('Enter an amount greater than zero.');
      return;
    }

    const selectedIngredient = recipe.recipe_data.ingredients[overrideIngredientIndex];
    const adjustedAmount = normalizeManualAmount(enteredAmount, getScalingType(selectedIngredient));
    const ingredients = recipe.recipe_data.ingredients.map((ingredient, index) => ({
      ...ingredient,
      base_quantity_decimal: getBaseQuantity(ingredient),
      manual_overridden: index === overrideIngredientIndex,
      override_quantity_decimal: index === overrideIngredientIndex ? adjustedAmount : undefined,
      override_target_yield: index === overrideIngredientIndex ? targetYield : undefined,
    }));

    setIsSavingOverride(true);
    try {
      await updateRecipe(recipe.id, {
        title: recipe.title,
        prep_time_minutes: recipe.recipe_data.prep_time_minutes ?? 0,
        cook_time_minutes: recipe.recipe_data.cook_time_minutes ?? 0,
        ingredients,
        instructions: recipe.recipe_data.instructions,
      });
      setRecipe({ ...recipe, recipe_data: { ...recipe.recipe_data, ingredients } });
      setOverrideIngredientIndex(null);
    } catch (error: any) {
      setOverrideError(error.message || 'Could not save this adjustment.');
    } finally {
      setIsSavingOverride(false);
    }
  };

  const clearOverride = async () => {
    if (!recipe) return;
    const ingredients = recipe.recipe_data.ingredients.map((ingredient) => ({
      ...ingredient,
      base_quantity_decimal: getBaseQuantity(ingredient),
      manual_overridden: false,
      override_quantity_decimal: undefined,
      override_target_yield: undefined,
    }));

    setIsSavingOverride(true);
    try {
      await updateRecipe(recipe.id, {
        title: recipe.title,
        prep_time_minutes: recipe.recipe_data.prep_time_minutes ?? 0,
        cook_time_minutes: recipe.recipe_data.cook_time_minutes ?? 0,
        ingredients,
        instructions: recipe.recipe_data.instructions,
      });
      setRecipe({ ...recipe, recipe_data: { ...recipe.recipe_data, ingredients } });
      setOverrideIngredientIndex(null);
    } catch (error: any) {
      setOverrideError(error.message || 'Could not remove this adjustment.');
    } finally {
      setIsSavingOverride(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Recipe not found.</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const atomicMultiplier = getAtomicMultiplier(recipe.recipe_data.ingredients, targetYield);
  const overrideIngredient = overrideIngredientIndex === null ? null : recipe.recipe_data.ingredients[overrideIngredientIndex];

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>

      {/* --- NEW: Wrapper for Side Margins --- */}
      <View style={styles.contentContainer}>

      {/* 2. The Functional Action Area (Just the Back Button here) */}
      {/* The Functional Action Area */}
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
        
        
        <View style={styles.recipeActions}>
        {/* We create two variables to determine exactly what the user is allowed to do */}
        {(() => {
          const isOwner = user?.id === recipe?.user_id;
          const isBookmark = recipe?.source_url?.startsWith('bookmark_');

          // 1. MY VAULT (Owner & Not a Bookmark): Show full edit controls
          if (isOwner && !isBookmark) {
            return (
              <>
                <TouchableOpacity onPress={handlePublishToggle} style={styles.editButton} disabled={isTogglingPublish}>
                  {isTogglingPublish ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Feather name={recipe?.is_public ? "globe" : "lock"} size={18} color={recipe?.is_public ? COLORS.success : COLORS.primary} />
                      <Text style={[styles.editButtonText, recipe?.is_public && { color: COLORS.success }]}> 
                        {recipe?.is_public ? 'Public' : 'Private'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push({ pathname: '/edit/[id]', params: { id: recipe?.id } })} style={styles.editButton}>
                  <Feather name="edit-2" size={18} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={styles.deleteButton}>
                  <Feather name="trash-2" size={18} color={COLORS.danger} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </>
            );
          }
          
          // 2. MY BOOKMARKS (Owner & IS a Bookmark): Show "Remove Bookmark" button
          if (isOwner && isBookmark) {
            return (
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(true)} // Calling Delete on a bookmark safely removes the clone!
                style={styles.deleteButton} // Using the red delete style for "Remove"
                activeOpacity={0.7}
              >
                <Feather name="bookmark" size={18} color={COLORS.danger} /> 
                <Text style={styles.deleteButtonText}>Remove Bookmark</Text>
              </TouchableOpacity>
            );
          }

          // 3. COMMUNITY FEED (Guest): Show "Save Recipe" button
          return (
            <TouchableOpacity onPress={handleBookmark} style={styles.editButton} disabled={isBookmarking}>
              {isBookmarking ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Feather name="bookmark" size={18} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Save Recipe</Text> 
                </>
              )}
            </TouchableOpacity>
          );
        })()}
      </View>

        {/* Add the AuthModal right before the closing </SafeAreaView> */}
        <AuthModal 
          visible={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      </View>




      {/* 3. The Recipe Content */}
      <ScrollView contentContainerStyle={styles.content}>
        {/* Title & Metadata */}
        {recipe.image_url ? <>
          <RecipeImage uri={recipe.image_url} title={recipe.title} variant="hero" />
          {recipe.image_attribution ? (
            recipe.image_source === 'extracted' && /^https?:\/\//.test(recipe.source_url)
              ? <TouchableOpacity onPress={() => void Linking.openURL(recipe.source_url)} accessibilityRole="link"><Text style={styles.imageAttribution}>{recipe.image_attribution} · View original</Text></TouchableOpacity>
              : <Text style={styles.imageAttribution}>{recipe.image_attribution}</Text>
          ) : null}
        </> : null}
        <Text style={styles.titleText}>{recipe.title}</Text>
        <Text style={styles.metaText}>
          Prep: {recipe.recipe_data.prep_time_minutes}m • Cook: {recipe.recipe_data.cook_time_minutes || 0}m
        </Text>
        <View style={styles.categoryLinks}>{(recipe.category_tags?.length ? recipe.category_tags : [recipe.category || 'Popular']).map((category) => <TouchableOpacity key={category} style={styles.categoryLink} onPress={() => router.push({ pathname: '/category/[name]', params: { name: category, scope: recipe.is_public ? 'community' : 'vault' } })} accessibilityRole="link" accessibilityLabel={`Browse ${category} recipes`}>
          <Text style={styles.categoryLinkText}>{category}</Text><Feather name="chevron-right" size={13} color={COLORS.primary} />
        </TouchableOpacity>)}</View>
        {recipe.dietary_tags?.length ? <View style={styles.dietaryTagRow}>{recipe.dietary_tags.map((tag) => {
          const emoji = DIETARY_FILTERS.find((filter) => filter.label === tag)?.emoji;
          return <Text key={tag} style={styles.dietaryTag}>{emoji ? `${emoji} ` : ''}{tag}</Text>;
        })}</View> : null}

        <View style={styles.yieldCard}>
          <View style={styles.yieldHeader}>
            <View style={styles.yieldHeaderCopy}>
              <Text style={styles.yieldLabel}>Target Yield</Text>
              <Text style={styles.yieldHelp}>Adjust ingredient amounts without changing your saved recipe.</Text>
            </View>
            <Text style={styles.yieldValue}>{targetYield.toFixed(2)}×</Text>
          </View>
          <TargetYieldSlider
            value={targetYield}
            onValueChange={setTargetYield}
            minimumTrackTintColor={COLORS.primary}
            maximumTrackTintColor={COLORS.secondary}
            thumbTintColor={COLORS.primary}
            style={styles.yieldSlider}
          />
          <View style={styles.yieldRange}>
            <Text style={styles.yieldRangeText}>0.25×</Text>
            <TouchableOpacity onPress={() => setTargetYield(1)}><Text style={styles.resetYieldText}>Reset</Text></TouchableOpacity>
            <Text style={styles.yieldRangeText}>4×</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startCookingButton} onPress={() => router.push({ pathname: '/cook/[id]', params: { id: recipe.id, targetYield: String(targetYield) } })} accessibilityRole="button" accessibilityLabel={`Start cooking ${recipe.title}`}>
          <Feather name="play" size={22} color={COLORS.background} />
          <View style={styles.startCookingTextBlock}><Text style={styles.startCookingTitle}>Start Cooking</Text><Text style={styles.startCookingSubtitle}>Step-by-step focus mode · Keeps screen awake</Text></View>
          <Feather name="chevron-right" size={22} color={COLORS.background} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Ingredients List */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        
        {recipe.recipe_data.ingredients.map((ingredient, index) => {
          const equivalent = formatEquivalentMeasurement(ingredient, atomicMultiplier);
          return <View key={index} style={styles.ingredientRow}>
            <View style={styles.bulletPoint} />
            <View style={styles.ingredientContent}>
              <Text style={styles.ingredientText}>
                <Text style={styles.boldAmount}>
                  {formatScaledQuantity(ingredient, atomicMultiplier)} {ingredient.unit}
                  {equivalent ? ` (${equivalent.quantity} ${equivalent.unit})` : ''}
                </Text>
                {' '}{ingredient.name}
              </Text>
              <Text style={styles.scalingTypeText}>{scalingTypeLabel(getScalingType(ingredient))}</Text>
            </View>
            <TouchableOpacity style={styles.adjustIngredientButton} onPress={() => openOverrideEditor(ingredient, index)}>
              <Feather name="sliders" size={16} color={COLORS.primary} />
              <Text style={styles.adjustIngredientText}>{ingredient.manual_overridden ? 'Linked' : 'Adjust'}</Text>
            </TouchableOpacity>
          </View>;
        })}

        {/* Instructions List */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>Instructions</Text>
        
        {recipe.recipe_data.instructions.map((instruction, index) => (
          <View key={index} style={styles.instructionRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            <Text style={styles.instructionText}>{instruction}</Text>
          </View>
        ))}
      </ScrollView>
      </View>{/* --- END of Wrapper --- */}

      <Modal visible={showDietaryReview} transparent animationType="fade" onRequestClose={() => !isTogglingPublish && setShowDietaryReview(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.dietaryReviewCard}>
            <ScrollView style={styles.dietaryReviewScroll} contentContainerStyle={styles.dietaryReviewContent} showsVerticalScrollIndicator={false}>
            <Feather name="check-circle" size={28} color={COLORS.primary} />
            <Text style={styles.confirmationTitle}>Review recipe tags</Text>
            <Text style={styles.confirmationText}>These categories and dietary labels were suggested by AI. Correct them before sharing.</Text>
            <RecipeTagEditor categoryTags={categoryDraft} dietaryTags={dietaryDraft} onCategoryTagsChange={setCategoryDraft} onDietaryTagsChange={setDietaryDraft} />
            <TouchableOpacity style={[styles.permissionButton, isTogglingPublish && styles.actionDisabled]} onPress={() => void publishAfterDietaryReview()} disabled={isTogglingPublish}>
              {isTogglingPublish ? <ActivityIndicator color={COLORS.background} /> : <Text style={styles.permissionButtonText}>Confirm Tags & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelDeleteButton} onPress={() => setShowDietaryReview(false)} disabled={isTogglingPublish}><Text style={styles.cancelDeleteText}>Cancel</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showImageRightsConfirm} transparent animationType="fade" onRequestClose={() => !isTogglingPublish && setShowImageRightsConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationCard}>
            <Feather name="shield" size={28} color={COLORS.primary} />
            <Text style={styles.confirmationTitle}>Publish this source image?</Text>
            <Text style={styles.confirmationText}>The photo came from the original recipe website. Only keep it in Community if you own it or have permission to republish it.</Text>
            <TouchableOpacity style={styles.removeImageButton} onPress={() => void publishAfterImageDecision(false)} disabled={isTogglingPublish}>
              <Text style={styles.removeImageText}>Remove Image & Publish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.permissionButton, isTogglingPublish && styles.actionDisabled]} onPress={() => void publishAfterImageDecision(true)} disabled={isTogglingPublish}>
              {isTogglingPublish ? <ActivityIndicator color={COLORS.background} /> : <Text style={styles.permissionButtonText}>I Have Permission — Publish</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelDeleteButton} onPress={() => setShowImageRightsConfirm(false)} disabled={isTogglingPublish}><Text style={styles.cancelDeleteText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeleting && setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationCard}>
            <Feather name="trash-2" size={28} color={COLORS.danger} />
            <Text style={styles.confirmationTitle}>Delete recipe?</Text>
            <Text style={styles.confirmationText}>
              “{recipe.title}” will be permanently removed.
            </Text>
            <View style={styles.confirmationActions}>
              <TouchableOpacity
                style={styles.cancelDeleteButton}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, isDeleting && styles.actionDisabled]}
                onPress={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Text style={styles.confirmDeleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={overrideIngredient !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !isSavingOverride && setOverrideIngredientIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.overrideCard}>
            <Feather name="sliders" size={28} color={COLORS.primary} />
            <Text style={styles.confirmationTitle}>Adjust {overrideIngredient?.name}</Text>
            <Text style={styles.confirmationText}>
              This amount becomes the linked reference at {targetYield.toFixed(2)}×. The rest of the recipe will follow its ratio.
            </Text>
            <TextInput
              style={styles.overrideInput}
              value={overrideAmount}
              onChangeText={(value) => { setOverrideAmount(value); setOverrideError(''); }}
              keyboardType="decimal-pad"
              placeholder="Amount"
              placeholderTextColor={COLORS.textSecondary}
              editable={!isSavingOverride}
            />
            {overrideError ? <Text style={styles.overrideError}>{overrideError}</Text> : null}
            <View style={styles.overrideActions}>
              {overrideIngredient?.manual_overridden ? (
                <TouchableOpacity style={styles.removeLinkButton} onPress={clearOverride} disabled={isSavingOverride}>
                  <Text style={styles.removeLinkText}>Remove Link</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.cancelDeleteButton} onPress={() => setOverrideIngredientIndex(null)} disabled={isSavingOverride}>
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveOverrideButton, isSavingOverride && styles.actionDisabled]} onPress={saveOverride} disabled={isSavingOverride}>
                {isSavingOverride ? <ActivityIndicator size="small" color={COLORS.surface} /> : <Text style={styles.saveOverrideText}>Link Amount</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  centered: { justifyContent: 'center', alignItems: 'center' },
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
    paddingTop: SPACING.lg, // Gives it some breathing room from the Header
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start', // Keeps it locked to the left
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
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
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  backTextFilled: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary, // Dark brown text for contrast
    marginTop: 2, // Slight optical alignment adjustment for the Poppins font
  },
  recipeActions: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: SPACING.xs },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm },
  editButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.primary },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm },
  deleteButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.danger },
  actionDisabled: { opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)', alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  confirmationCard: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.lg, alignItems: 'center' },
  confirmationTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 22, color: COLORS.textPrimary, marginTop: SPACING.sm },
  confirmationText: { fontFamily: TYPOGRAPHY.body, fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, width: '100%', marginTop: SPACING.lg },
  removeImageButton: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 8 },
  removeImageText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.primary },
  permissionButton: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, backgroundColor: COLORS.primary, borderRadius: 8 },
  permissionButtonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 14, color: COLORS.background },
  dietaryReviewCard: { width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.lg, alignItems: 'center' },
  dietaryReviewScroll: { width: '100%' },
  dietaryReviewContent: { alignItems: 'center' },
  dietaryTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  dietaryTag: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: COLORS.primary, backgroundColor: COLORS.surface, borderColor: COLORS.secondary, borderWidth: 1, borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  categoryLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  categoryLink: { flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: 999, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  categoryLinkText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12, color: COLORS.primary },
  cancelDeleteButton: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  cancelDeleteText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: COLORS.primary },
  confirmDeleteButton: { minWidth: 92, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md, borderRadius: 8, backgroundColor: COLORS.danger },
  confirmDeleteText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: COLORS.surface },
  overrideCard: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.lg, alignItems: 'center' },
  overrideInput: { width: '100%', minHeight: 48, marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 8, paddingHorizontal: SPACING.md, fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textPrimary, backgroundColor: COLORS.background },
  overrideError: { alignSelf: 'flex-start', marginTop: SPACING.xs, fontFamily: TYPOGRAPHY.body, fontSize: 13, color: COLORS.danger },
  overrideActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: SPACING.xs, width: '100%', marginTop: SPACING.lg },
  removeLinkButton: { marginRight: 'auto', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xs },
  removeLinkText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13, color: COLORS.danger },
  saveOverrideButton: { minWidth: 110, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.md, borderRadius: 8, backgroundColor: COLORS.primary },
  saveOverrideText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: COLORS.surface },
  backButton: { 
    alignSelf: 'flex-start' // Keeps the touchable area strictly around the text
  },
  backText: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 16, 
    color: COLORS.primary // Back to brown, since it's on a white background again!
  },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  titleText: { fontFamily: TYPOGRAPHY.heading, fontSize: 36, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  imageAttribution: { fontFamily: TYPOGRAPHY.body, fontSize: 11, color: COLORS.textSecondary, marginTop: -SPACING.md, marginBottom: SPACING.lg },
  metaText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 14, color: COLORS.primary, marginBottom: SPACING.lg },
  yieldCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.secondary },
  yieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.sm },
  yieldHeaderCopy: { flex: 1, minWidth: 0 },
  yieldLabel: { fontFamily: TYPOGRAPHY.heading, fontSize: 18, color: COLORS.textPrimary },
  yieldHelp: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  yieldValue: { flexShrink: 0, fontFamily: TYPOGRAPHY.heading, fontSize: 24, color: COLORS.primary },
  yieldSlider: { width: '100%', height: 40, marginTop: SPACING.sm },
  yieldRange: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yieldRangeText: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.textSecondary },
  startCookingButton: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, marginTop: SPACING.md },
  startCookingTextBlock: { flex: 1 },
  startCookingTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 17, color: COLORS.background },
  startCookingSubtitle: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: COLORS.background, opacity: 0.82, marginTop: 1 },
  resetYieldText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13, color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.secondary, marginBottom: SPACING.lg, opacity: 0.5 },
  sectionTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 22, color: COLORS.textPrimary, marginBottom: SPACING.md },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm, paddingRight: SPACING.md },
  bulletPoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 8, marginRight: SPACING.sm },
  ingredientContent: { flex: 1 },
  ingredientText: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary, lineHeight: 24 },
  scalingTypeText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: COLORS.primary, marginTop: 1 },
  adjustIngredientButton: { alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.sm, minWidth: 48, paddingVertical: SPACING.xs },
  adjustIngredientText: { fontFamily: TYPOGRAPHY.heading, fontSize: 11, color: COLORS.primary, marginTop: 2 },
  boldAmount: { fontFamily: TYPOGRAPHY.heading, color: COLORS.textPrimary },
  errorText: { fontFamily: TYPOGRAPHY.heading, fontSize: 18, color: COLORS.textPrimary, marginBottom: SPACING.md },
  instructionRow: { 
    flexDirection: 'row', 
    marginBottom: SPACING.md, 
    paddingRight: SPACING.md 
  },
  stepCircle: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: SPACING.sm, 
    marginTop: 2 
  },
  stepNumber: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 12, 
    color: COLORS.textPrimary 
  },
  instructionText: { 
    fontFamily: TYPOGRAPHY.body, 
    fontSize: 16, 
    color: COLORS.textSecondary, 
    flex: 1, 
    lineHeight: 24 
  },
}, textScale);
