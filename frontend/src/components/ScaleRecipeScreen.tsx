import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { extractAndSaveRecipe } from '../api/index';

export default function ScaleRecipeScreen() {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  
  // Holds the extracted data so the user can review and edit it
  const [recipeData, setRecipeData] = useState<any>(null);

  const handleExtract = async () => {
    setExtractError('');
    setRecipeData(null);

    if (!url.trim()) {
      setExtractError('Please enter a valid recipe URL.');
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extractAndSaveRecipe(url, 1.0);
      setRecipeData(result.data); 
    } catch (error: any) {
      // Error is caught and explicitly set to state to display on the UI directly
      setExtractError(error.message || 'Failed to extract recipe.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.headerTitle}>Scale Recipe</Text>
      
      {/* URL Input Section */}
      <View style={styles.inputCard}>
        <Text style={styles.label}>Recipe URL</Text>
        <TextInput 
          style={styles.input} 
          placeholder="https://www.allrecipes.com/..." 
          placeholderTextColor="#999"
          value={url}
          onChangeText={(text) => {
            setUrl(text);
            setExtractError('');
          }}
          autoCapitalize="none"
          keyboardType="url"
        />

        {/* --- ERROR UI DISPLAY --- */}
        {extractError ? (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color="#D32F2F" />
            <Text style={styles.errorText}>{extractError}</Text>
          </View>
        ) : null}

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleExtract}
          disabled={isExtracting}
        >
          {isExtracting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>Extract Recipe</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Editable Recipe View (Visible only after successful extraction) */}
      {recipeData && (
        <View style={styles.recipeEditor}>
          <Text style={styles.successTitle}>Extraction Successful!</Text>
          
          <Text style={styles.label}>Title</Text>
          <TextInput 
            style={styles.input} 
            value={recipeData.title} 
            onChangeText={(text) => setRecipeData({...recipeData, title: text})}
          />

          <Text style={styles.label}>Ingredients</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            multiline 
            value={recipeData.ingredients?.join('\n')}
            onChangeText={(text) => setRecipeData({...recipeData, ingredients: text.split('\n')})}
          />

          <Text style={styles.label}>Instructions</Text>
          <TextInput 
            style={[styles.input, styles.textArea]} 
            multiline 
            value={recipeData.instructions?.join('\n')}
            onChangeText={(text) => setRecipeData({...recipeData, instructions: text.split('\n')})}
          />

          <TouchableOpacity style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF6E5',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#5D4037',
    marginBottom: 20,
  },
  inputCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#5D4037',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recipeEditor: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 20,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});