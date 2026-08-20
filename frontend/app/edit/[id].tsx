import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { fetchRecipeById, updateRecipe } from '../../src/api';
import { COLORS, SPACING, TYPOGRAPHY } from '../../src/theme';
import { IngredientItem } from '../../src/types';
import { AppColors, usePreferences } from '../../src/contexts/PreferencesContext';
import { createThemedStyles } from '../../src/theme/createThemedStyles';
import RecipeImageUpload from '../../src/components/RecipeImageUpload';
import RecipeTagEditor from '../../src/components/RecipeTagEditor';

type EditableIngredient = { quantity: string; unit: string; name: string; scaling_type?: IngredientItem['scaling_type'] };

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState<EditableIngredient[]>([{ quantity: '', unit: '', name: '' }]);
  const [instructions, setInstructions] = useState(['']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [imageSourceUrl, setImageSourceUrl] = useState<string | null>(null);
  const [imageAttribution, setImageAttribution] = useState<string | null>(null);
  const [imageUsageConfirmed, setImageUsageConfirmed] = useState(false);
  const [categoryTags, setCategoryTags] = useState<string[]>([]);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);

  useEffect(() => {
    const loadRecipe = async () => {
      if (typeof id !== 'string') {
        setLoading(false);
        return;
      }
      const recipe = await fetchRecipeById(id);
      if (recipe) {
        setTitle(recipe.title);
        setPrepTime(String(recipe.recipe_data.prep_time_minutes ?? ''));
        setCookTime(String(recipe.recipe_data.cook_time_minutes ?? ''));
        const editableIngredients = recipe.recipe_data.ingredients.map((ingredient: any) => ({
          quantity: String(ingredient.base_quantity_decimal ?? ingredient.quantity_decimal ?? ingredient.quantity_fraction),
          unit: ingredient.unit ?? '',
          name: ingredient.name ?? '',
          scaling_type: ingredient.scaling_type,
        }));
        setIngredients(editableIngredients.length ? editableIngredients : [{ quantity: '', unit: '', name: '' }]);
        setInstructions(recipe.recipe_data.instructions.length ? recipe.recipe_data.instructions : ['']);
        setImageUrl(recipe.image_url || null);
        setImageSource(recipe.image_source || null);
        setImageSourceUrl(recipe.image_source_url || null);
        setImageAttribution(recipe.image_attribution || null);
        setImageUsageConfirmed(Boolean(recipe.image_usage_confirmed));
        setCategoryTags(recipe.category_tags?.length ? recipe.category_tags : [recipe.category || 'Popular']);
        setDietaryTags(recipe.dietary_tags || []);
      }
      setLoading(false);
    };
    void loadRecipe();
  }, [id]);

  const updateIngredient = (index: number, field: keyof EditableIngredient, value: string) => {
    setIngredients((current) => current.map((ingredient, ingredientIndex) =>
      ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
    ));
  };

  const saveRecipe = async () => {
    if (typeof id !== 'string' || !title.trim()) {
      Alert.alert('Recipe title required', 'Please enter a recipe title.');
      return;
    }
    if (imageUrl && !imageUsageConfirmed) {
      Alert.alert('Image permission required', 'Confirm that you own or have permission to use this image.');
      return;
    }
    setSaving(true);
    try {
      await updateRecipe(id, {
        title: title.trim(),
        prep_time_minutes: Number.parseInt(prepTime, 10) || 0,
        cook_time_minutes: Number.parseInt(cookTime, 10) || 0,
        ingredients: ingredients.filter((ingredient) => ingredient.name.trim()).map((ingredient) => ({
          quantity_decimal: Number.parseFloat(ingredient.quantity) || 0,
          base_quantity_decimal: Number.parseFloat(ingredient.quantity) || 0,
          quantity_fraction: ingredient.quantity,
          unit: ingredient.unit.trim(),
          name: ingredient.name.trim(),
          scaling_type: ingredient.scaling_type,
          manual_overridden: false,
        })),
        instructions: instructions.map((step) => step.trim()).filter(Boolean),
        image_url: imageUrl,
        image_source: imageSource,
        image_source_url: imageSourceUrl,
        image_attribution: imageAttribution,
        image_usage_confirmed: imageUsageConfirmed,
        category_tags: categoryTags,
        dietary_tags: dietaryTags,
      });
      router.replace(`/${id}`);
    } catch (error: any) {
      Alert.alert('Could not save recipe', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={[styles.safeArea, styles.centered]}><ActivityIndicator size="large" color={COLORS.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <View style={styles.contentContainer}>
        <View style={styles.actionArea}>
          <TouchableOpacity           onPress={() => {
            if (router.canGoBack()) {

                router.back();
              
              } else {
              
                router.replace('/');
              
              }} 
          } style={styles.backButton} activeOpacity={0.7}>
            <Feather name="arrow-left" size={20} color={COLORS.primary} />
            <Text style={styles.backText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.pageTitle}>Edit Recipe</Text>
          <Field styles={styles} colors={colors} label="Recipe Title" value={title} onChangeText={setTitle} placeholder="Recipe title" />
          <View style={styles.timeRow}>
            <View style={styles.timeField}><Field styles={styles} colors={colors} label="Prep Time (min)" value={prepTime} onChangeText={setPrepTime} placeholder="0" keyboardType="numeric" /></View>
            <View style={styles.timeField}><Field styles={styles} colors={colors} label="Cook Time (min)" value={cookTime} onChangeText={setCookTime} placeholder="0" keyboardType="numeric" /></View>
          </View>
          <Text style={styles.sectionTitle}>Recipe Image <Text style={styles.optionalText}>(Optional)</Text></Text>
          <RecipeImageUpload
            currentUri={imageUrl}
            title={title || 'Recipe image'}
            onUploaded={({ imageUrl: uploadedUrl, objectPath }) => { setImageUrl(uploadedUrl); setImageSource('upload'); setImageSourceUrl(objectPath); setImageAttribution('Photo uploaded by recipe owner'); setImageUsageConfirmed(false); }}
            onRemove={() => { setImageUrl(null); setImageSource(null); setImageSourceUrl(null); setImageAttribution(null); setImageUsageConfirmed(false); }}
          />
          {imageUrl ? <TouchableOpacity style={styles.permissionRow} onPress={() => setImageUsageConfirmed((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: imageUsageConfirmed }}>
            <Feather name={imageUsageConfirmed ? 'check-square' : 'square'} size={22} color={COLORS.primary} />
            <Text style={styles.permissionText}>I own this image or have permission to use it.</Text>
          </TouchableOpacity> : null}
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.map((ingredient, index) => (
            <View style={styles.ingredientRow} key={index}>
              <TextInput style={[styles.input, styles.quantityInput]} value={ingredient.quantity} onChangeText={(value) => updateIngredient(index, 'quantity', value)} placeholder="Qty" placeholderTextColor={COLORS.textSecondary} />
              <TextInput style={[styles.input, styles.unitInput]} value={ingredient.unit} onChangeText={(value) => updateIngredient(index, 'unit', value)} placeholder="Unit" placeholderTextColor={COLORS.textSecondary} />
              <TextInput style={[styles.input, styles.nameInput]} value={ingredient.name} onChangeText={(value) => updateIngredient(index, 'name', value)} placeholder="Ingredient" placeholderTextColor={COLORS.textSecondary} />
              {ingredients.length > 1 && <TouchableOpacity style={styles.removeButton} onPress={() => setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Feather name="x" size={18} color={COLORS.primary} /></TouchableOpacity>}
            </View>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={() => setIngredients((current) => [...current, { quantity: '', unit: '', name: '' }])}><Text style={styles.addText}>+ Add Ingredient</Text></TouchableOpacity>
          <Text style={styles.sectionTitle}>Recipe Tags</Text>
          <Text style={styles.tagHelp}>Choose every category that fits this recipe. Use the “All …” controls to open each complete tag menu.</Text>
          <RecipeTagEditor categoryTags={categoryTags} dietaryTags={dietaryTags} onCategoryTagsChange={setCategoryTags} onDietaryTagsChange={setDietaryTags} />
          <Text style={styles.sectionTitle}>Instructions</Text>
          {instructions.map((instruction, index) => (
            <View style={styles.instructionRow} key={index}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <TextInput style={[styles.input, styles.instructionInput]} value={instruction} onChangeText={(value) => setInstructions((current) => current.map((step, stepIndex) => stepIndex === index ? value : step))} placeholder={`Step ${index + 1}`} placeholderTextColor={COLORS.textSecondary} multiline />
              {instructions.length > 1 && <TouchableOpacity style={styles.removeButton} onPress={() => setInstructions((current) => current.filter((_, stepIndex) => stepIndex !== index))}><Feather name="x" size={18} color={COLORS.primary} /></TouchableOpacity>}
            </View>
          ))}
          <TouchableOpacity style={styles.addButton} onPress={() => setInstructions((current) => [...current, ''])}><Text style={styles.addText}>+ Add Step</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.saveButton, saving && styles.disabled]} onPress={saveRecipe} disabled={saving}>{saving ? <ActivityIndicator color={COLORS.surface} /> : <Text style={styles.saveText}>Save Changes</Text>}</TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, styles, colors, ...props }: { label: string; styles: any; colors: AppColors; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'numeric' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} placeholderTextColor={colors.textSecondary} {...props} /></View>;
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.background }, optionalText: { fontFamily: TYPOGRAPHY.body, fontSize: 13, color: COLORS.textSecondary }, permissionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm }, permissionText: { flex: 1, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, lineHeight: 20, color: COLORS.textPrimary }, centered: { alignItems: 'center', justifyContent: 'center' }, contentContainer: { flex: 1, width: '100%', maxWidth: 1250, alignSelf: 'center' }, actionArea: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg }, backButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, borderColor: COLORS.secondary, backgroundColor: COLORS.surface }, backText: { fontFamily: TYPOGRAPHY.heading, color: COLORS.primary, fontSize: 16 }, content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 }, pageTitle: { fontFamily: TYPOGRAPHY.heading, color: COLORS.textPrimary, fontSize: 32, marginBottom: SPACING.lg }, field: { marginBottom: SPACING.md }, label: { fontFamily: TYPOGRAPHY.heading, color: COLORS.primary, fontSize: 14, marginBottom: SPACING.xs }, input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.secondary, borderRadius: 8, backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, color: COLORS.textPrimary, fontFamily: TYPOGRAPHY.body, fontSize: 16 }, timeRow: { flexDirection: 'row', gap: SPACING.md }, timeField: { flex: 1 }, sectionTitle: { fontFamily: TYPOGRAPHY.heading, color: COLORS.textPrimary, fontSize: 20, marginTop: SPACING.lg, marginBottom: SPACING.md }, tagHelp: { fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, marginTop: -SPACING.sm }, ingredientRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm, alignItems: 'center' }, quantityInput: { flex: 1 }, unitInput: { flex: 1.3 }, nameInput: { flex: 2.5 }, removeButton: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' }, addButton: { alignSelf: 'flex-start', paddingVertical: SPACING.sm }, addText: { fontFamily: TYPOGRAPHY.heading, color: COLORS.primary, fontSize: 14 }, instructionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'flex-start' }, stepNumber: { fontFamily: TYPOGRAPHY.heading, color: COLORS.textPrimary, marginTop: SPACING.md, width: 20, textAlign: 'center' }, instructionInput: { flex: 1, paddingTop: SPACING.sm, paddingBottom: SPACING.sm, textAlignVertical: 'top' }, saveButton: { backgroundColor: COLORS.primary, borderRadius: 12, marginTop: SPACING.xl, alignItems: 'center', justifyContent: 'center', minHeight: 52 }, saveText: { fontFamily: TYPOGRAPHY.heading, color: COLORS.surface, fontSize: 18 }, disabled: { opacity: 0.7 },
}, textScale);
