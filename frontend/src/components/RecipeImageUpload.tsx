import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { uploadRecipeImage } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import { SPACING, TYPOGRAPHY } from '../theme';
import RecipeImage from './RecipeImage';

export type UploadedRecipeImage = { imageUrl: string; objectPath: string };

type Props = {
  currentUri?: string | null;
  title: string;
  onUploaded: (image: UploadedRecipeImage) => void;
  onRemove: () => void;
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('The selected image could not be read.'));
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    const base64 = result.split(',')[1];
    if (!base64) reject(new Error('The selected image could not be prepared.'));
    else resolve(base64);
  };
  reader.readAsDataURL(blob);
});

const compressWebImage = async (asset: ImagePicker.ImagePickerAsset) => {
  const source: Blob = asset.file
    ? asset.file
    : await fetch(asset.uri).then((response) => response.blob());
  const bitmap = await createImageBitmap(source);

  try {
    if (!Number.isFinite(bitmap.width) || !Number.isFinite(bitmap.height) || bitmap.width <= 0 || bitmap.height <= 0) {
      throw new Error('This image has invalid dimensions. Please choose a different image.');
    }

    const scale = Math.min(1, 1600 / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    context.drawImage(bitmap, 0, 0, width, height);

    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Your browser could not compress this image.')),
        'image/jpeg',
        0.72
      );
    });
    return blobToBase64(compressed);
  } finally {
    bitmap.close();
  }
};

export default function RecipeImageUpload({ currentUri, title, onUploaded, onRemove }: Props) {
  const { colors } = usePreferences();
  const [previewUri, setPreviewUri] = useState(currentUri || '');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (currentUri && !previewUri) setPreviewUri(currentUri); }, [currentUri, previewUri]);

  const processResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setWorking(true);
    setError('');
    setPreviewUri(asset.uri);
    try {
      let base64: string;
      if (Platform.OS === 'web') {
        base64 = await compressWebImage(asset);
      } else {
        const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
        if (Number.isFinite(asset.width) && asset.width > 1600) context.resize({ width: 1600, height: null });
        const rendered = await context.renderAsync();
        const compressed = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.72, base64: true });
        if (!compressed.base64) throw new Error('The compressed image could not be prepared.');
        base64 = compressed.base64;
      }
      const uploaded = await uploadRecipeImage(base64);
      onUploaded({ imageUrl: uploaded.image_url, objectPath: uploaded.object_path });
    } catch (caught: any) {
      setPreviewUri(currentUri || '');
      setError(caught.message || 'Could not upload this image.');
    } finally {
      setWorking(false);
    }
  };

  const choosePhoto = async () => processResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: Platform.OS !== 'web', aspect: [4, 3], quality: 0.9 }));
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Camera permission is required to take a recipe photo.'); return; }
    await processResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.9 }));
  };
  const remove = () => { setPreviewUri(''); setError(''); onRemove(); };

  return (
    <View>
      {previewUri ? <RecipeImage uri={previewUri} title={title || 'Recipe image'} variant="hero" /> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, { borderColor: colors.secondary }]} onPress={choosePhoto} disabled={working} accessibilityRole="button">
          <Feather name="upload" size={18} color={colors.primary} /><Text style={[styles.buttonText, { color: colors.primary }]}>{previewUri ? 'Replace Image' : 'Choose Image'}</Text>
        </TouchableOpacity>
        {Platform.OS !== 'web' ? <TouchableOpacity style={[styles.button, { borderColor: colors.secondary }]} onPress={takePhoto} disabled={working} accessibilityRole="button">
          <Feather name="camera" size={18} color={colors.primary} /><Text style={[styles.buttonText, { color: colors.primary }]}>Take Photo</Text>
        </TouchableOpacity> : null}
        {previewUri ? <TouchableOpacity style={styles.removeButton} onPress={remove} disabled={working} accessibilityRole="button"><Feather name="trash-2" size={18} color={colors.danger} /><Text style={[styles.buttonText, { color: colors.danger }]}>Remove</Text></TouchableOpacity> : null}
      </View>
      {working ? <View style={styles.status}><ActivityIndicator color={colors.primary} /><Text style={[styles.statusText, { color: colors.textSecondary }]}>Compressing and uploading…</Text></View> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, borderWidth: 1, borderRadius: 9 },
  removeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md },
  buttonText: { fontFamily: TYPOGRAPHY.heading, fontSize: 13 },
  status: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  statusText: { fontFamily: TYPOGRAPHY.body, fontSize: 12 },
  error: { marginTop: SPACING.sm, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12 },
});
