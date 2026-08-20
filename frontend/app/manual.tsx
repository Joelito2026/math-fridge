// app/manual.tsx
import { useState, useEffect } from 'react'; // <-- Add this right here at the top
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY, SPACING } from '../src/theme';
import { AppColors, usePreferences } from '../src/contexts/PreferencesContext';
import { createThemedStyles } from '../src/theme/createThemedStyles';
import { saveManualRecipe } from '../src/api'; // <-- Add this import
import { Feather } from '@expo/vector-icons';

// --- NEW IMPORTS ---
import { supabase } from '../src/services/supabase';
import { User } from '@supabase/supabase-js';
import AuthModal from '../src/components/AuthModal';
import RecipeImage from '../src/components/RecipeImage';
import RecipeImageUpload from '../src/components/RecipeImageUpload';

export default function ManualEntryScreen() {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const COLORS = colors;
  const styles = createStyles(colors, textScale);

  // Basic Form State ---
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');

  // --- NEW: Dynamic Array State ---
  // We initialize with one empty row so the user has somewhere to start typing
  const [ingredients, setIngredients] = useState([{ quantity: '', unit: '', name: '' }]);
  const [instructions, setInstructions] = useState(['']); 
  const [imageUrl, setImageUrl] = useState('');
  const [imageAttribution, setImageAttribution] = useState('');
  const [imageRightsConfirmed, setImageRightsConfirmed] = useState(false);
  const [imageSource, setImageSource] = useState<'upload' | 'user_url' | null>(null);
  const [imageSourceUrl, setImageSourceUrl] = useState('');
  
  // --- NEW: AUTH STATE ---
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // --- NEW: Helper Functions for Ingredients ---
  const addIngredientRow = () => {
    setIngredients([...ingredients, { quantity: '', unit: '', name: '' }]);
  };

  const updateIngredient = (text: string, index: number, field: 'quantity' | 'unit' | 'name') => {
    const newIngredients = [...ingredients];
    newIngredients[index][field] = text;
    setIngredients(newIngredients);
  };

  const removeIngredientRow = (indexToRemove: number) => {
    const newIngredients = ingredients.filter((_, index) => index !== indexToRemove);
    setIngredients(newIngredients);
  };

  // --- NEW: Helper Functions for Instructions ---
  const addInstructionRow = () => {
    setInstructions([...instructions, '']);
  };

  const updateInstruction = (text: string, index: number) => {
    const newInstructions = [...instructions];
    newInstructions[index] = text;
    setInstructions(newInstructions);
  };

  const removeInstructionRow = (indexToRemove: number) => {
    const newInstructions = instructions.filter((_, index) => index !== indexToRemove);
    setInstructions(newInstructions);
  };

  const handleSave = async () => {
    // --- NEW: THE UX BLOCKER ---
    if (!user) {
      setShowAuthModal(true);
      return; // Stop the function here so it doesn't hit the API
    }

    // Basic validation
    if (!title.trim()) {
      alert("Please enter a recipe title.");
      return;
    }
    if (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) {
      alert("Image URL must start with http:// or https://.");
      return;
    }
    if (imageUrl.trim() && !imageRightsConfirmed) {
      alert("Please confirm that you own or have permission to use the image.");
      return;
    }

    // Package the state into the exact JSON format the backend expects
    const payload = {
      title: title,
      prep_time_minutes: parseInt(prepTime) || 0,
      cook_time_minutes: parseInt(cookTime) || 0,
      ingredients: ingredients,
      instructions: instructions.filter(step => step.trim() !== ''),
      image_url: imageUrl.trim() || null,
      image_attribution: imageAttribution.trim() || null,
      image_usage_confirmed: imageUrl.trim() ? imageRightsConfirmed : false,
      image_source: imageSource,
      image_source_url: imageSourceUrl || imageUrl.trim() || null,
    };

    try {
      setIsSaving(true);
      await saveManualRecipe(payload);
      router.replace('/'); // Send them back to the Home Screen on success!
    } catch (error: any) {
      Alert.alert('Could not save recipe', error.message || 'Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      
     {/* --- NEW: Wrapper for Side Margins --- */}
     <View style={styles.contentContainer}>

      {/* 2. The Functional Action Area */}
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
          <Text style={styles.backTextFilled}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* 3. The Form Content Area */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Create Recipe</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipe Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Grandma's Lasagna"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: SPACING.sm }]}>
            <Text style={styles.label}>Prep Time (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="15"
              placeholderTextColor={COLORS.textSecondary}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.sm }]}>
            <Text style={styles.label}>Cook Time (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="45"
              placeholderTextColor={COLORS.textSecondary}
              value={cookTime}
              onChangeText={setCookTime}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recipe Image <Text style={styles.optionalText}>(Optional)</Text></Text></View>
        <RecipeImageUpload
          currentUri={imageSource === 'upload' ? imageUrl : null}
          title={title || 'Recipe preview'}
          onUploaded={({ imageUrl: uploadedUrl, objectPath }) => { setImageUrl(uploadedUrl); setImageSource('upload'); setImageSourceUrl(objectPath); setImageAttribution('Photo uploaded by recipe owner'); setImageRightsConfirmed(false); }}
          onRemove={() => { setImageUrl(''); setImageSource(null); setImageSourceUrl(''); setImageAttribution(''); setImageRightsConfirmed(false); }}
        />
        <Text style={styles.imageHelp}>Or paste a direct image URL for a photo you own or have permission to use.</Text>
        <TextInput style={styles.input} placeholder="https://example.com/my-recipe.jpg" placeholderTextColor={COLORS.textSecondary} value={imageSource === 'user_url' ? imageUrl : ''} onChangeText={(value) => { setImageUrl(value); setImageSource(value.trim() ? 'user_url' : null); setImageSourceUrl(value); setImageRightsConfirmed(false); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        {imageUrl.trim() && imageSource === 'user_url' ? <RecipeImage uri={imageUrl.trim()} title={title || 'Recipe preview'} variant="hero" /> : null}
        {imageUrl.trim() ? <>
          <TextInput style={[styles.input, { marginTop: SPACING.sm }]} placeholder="Photo credit or attribution (optional)" placeholderTextColor={COLORS.textSecondary} value={imageAttribution} onChangeText={setImageAttribution} />
          <View style={styles.rightsRow}>
            <Text style={styles.rightsText}>I own this image or have permission to use it.</Text>
            <Switch value={imageRightsConfirmed} onValueChange={setImageRightsConfirmed} trackColor={{ false: COLORS.secondary, true: COLORS.primary }} thumbColor={COLORS.surface} accessibilityLabel="Confirm permission to use recipe image" />
          </View>
        </> : null}
        <View style={styles.divider} />

        {/* --- DYNAMIC INGREDIENTS SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
        </View>

        {ingredients.map((ing, index) => (
          <View key={index} style={styles.dynamicRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: SPACING.xs }]}
              placeholder="Qty (e.g., 1.5)"
              placeholderTextColor={COLORS.textSecondary}
              value={ing.quantity}
              onChangeText={(text) => updateIngredient(text, index, 'quantity')}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1.5, marginRight: SPACING.xs }]}
              placeholder="Unit (e.g., cups)"
              placeholderTextColor={COLORS.textSecondary}
              value={ing.unit}
              onChangeText={(text) => updateIngredient(text, index, 'unit')}
            />
            <TextInput
              style={[styles.input, { flex: 3 }]}
              placeholder="Name (e.g., Flour)"
              placeholderTextColor={COLORS.textSecondary}
              value={ing.name}
              onChangeText={(text) => updateIngredient(text, index, 'name')}
            />
            {ingredients.length > 1 && (
              <TouchableOpacity 
                style={styles.deleteIconBtn} 
                onPress={() => removeIngredientRow(index)}
              >
                <Text style={styles.deleteIconText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        
        <TouchableOpacity style={styles.addTextButton} onPress={addIngredientRow}>
          <Text style={styles.addTextButtonLabel}>+ Add Ingredient</Text>
        </TouchableOpacity>


        <View style={styles.divider} />

        {/* --- DYNAMIC INSTRUCTIONS SECTION --- */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Instructions</Text>
        </View>

        {instructions.map((step, index) => (
          <View key={index} style={styles.dynamicRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1, minHeight: 48 }]}
              placeholder={`Step ${index + 1}...`}
              placeholderTextColor={COLORS.textSecondary}
              value={step}
              onChangeText={(text) => updateInstruction(text, index)}
              multiline
            />
            {/* NEW: Delete Button */}
            {instructions.length > 1 && (
              <TouchableOpacity 
                style={styles.deleteIconBtn} 
                onPress={() => removeInstructionRow(index)}
              >
                <Text style={styles.deleteIconText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addTextButton} onPress={addInstructionRow}>
          <Text style={styles.addTextButtonLabel}>+ Add Step</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveButton, isSaving && styles.disabled]} onPress={handleSave} disabled={isSaving}>
          {isSaving ? <><ActivityIndicator color={COLORS.surface} /><Text style={styles.saveButtonText}>Analyzing & Saving…</Text></> : <Text style={styles.saveButtonText}>Save Recipe</Text>}
        </TouchableOpacity>

        <View style={{ height: 100 }} /> 
      </ScrollView>
      </View>
      {/* --- END of Wrapper --- */}
      <AuthModal 
        visible={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  optionalText: { fontFamily: TYPOGRAPHY.body, fontSize: 13, color: COLORS.textSecondary },
  imageHelp: { fontFamily: TYPOGRAPHY.body, fontSize: 13, lineHeight: 20, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  rightsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md, marginTop: SPACING.md },
  rightsText: { flex: 1, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, lineHeight: 20, color: COLORS.textPrimary },
  topHeader: { 
    backgroundColor: COLORS.primary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: SPACING.md 
  },
  contentContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 1250, 
    alignSelf: 'center', 
  },
  headerLogoText: { 
    fontFamily: TYPOGRAPHY.logo, 
    fontSize: 42, // Keeping your updated size!
    color: COLORS.secondary // Using your tan color update!
  },
  actionArea: { 
    paddingHorizontal: SPACING.lg, 
    paddingTop: SPACING.lg, // Gives it some breathing room from the Header
    paddingBottom: SPACING.xs,
    alignItems: 'flex-start', // Keeps it locked to the left
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.secondary,
    marginVertical: SPACING.lg,
    opacity: 0.3,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  addTextButton: {
    paddingVertical: SPACING.sm,
    alignSelf: 'flex-start',
  },
  addTextButtonLabel: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.primary,
  },
  stepCircle: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: SPACING.sm, 
    marginTop: 10 
  },
  stepNumber: { 
    fontFamily: TYPOGRAPHY.heading, 
    fontSize: 12, 
    color: COLORS.textPrimary 
  },
  deleteIconBtn: {
    width: 48, // Matches the height of your TextInputs
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  deleteIconText: {
    fontFamily: TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.secondary, // Uses your tan color so it isn't a glaring red alarm
  },
  saveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
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
  disabled: { opacity: 0.65 },
  backButton: { alignSelf: 'flex-start' },
  backText: { fontFamily: TYPOGRAPHY.heading, fontSize: 16, color: COLORS.primary },
  content: { padding: SPACING.lg },
  pageTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 32, color: COLORS.textPrimary, marginBottom: SPACING.md },
  subtitle: { fontFamily: TYPOGRAPHY.body, fontSize: 16, color: COLORS.textSecondary }
}, textScale);
