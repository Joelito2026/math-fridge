import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GestureResponderEvent, Platform, Text, TouchableOpacity, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { DIETARY_FILTERS } from '../dietary';
import { AppColors, usePreferences } from '../contexts/PreferencesContext';
import { getShadowStyle, SPACING, TYPOGRAPHY } from '../theme';
import { createThemedStyles } from '../theme/createThemedStyles';
import { RecipeResponse } from '../types';
import RecipeImage from './RecipeImage';

type RecipeCardProps = {
  recipe: RecipeResponse;
  scope: 'community' | 'vault';
  onDeleteRequest?: (recipe: RecipeResponse) => void;
};

export default function RecipeCard({ recipe, scope, onDeleteRequest }: RecipeCardProps) {
  const router = useRouter();
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);
  const category = recipe.category?.trim() || 'Popular';
  const displayedTags = recipe.dietary_tags?.slice(0, 2) || [];
  const hiddenTagCount = Math.max(0, (recipe.dietary_tags?.length || 0) - displayedTags.length);
  const canDelete = scope === 'vault' && Boolean(onDeleteRequest);

  const openCategory = (event: GestureResponderEvent) => {
    event.stopPropagation();
    router.push({ pathname: '/category/[name]', params: { name: category, scope } });
  };

  const card = (
    <TouchableOpacity
      style={[styles.card, canDelete && styles.cardInSwipeable]}
      activeOpacity={0.72}
      onPress={() => router.push(`/${recipe.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`Open ${recipe.title}`}
      accessibilityHint={canDelete ? 'Swipe left to reveal the delete action.' : undefined}
      accessibilityActions={canDelete ? [{ name: 'delete', label: `Delete ${recipe.title}` }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'delete') onDeleteRequest?.(recipe);
      }}
    >
      <RecipeImage uri={recipe.image_url} title={recipe.title} />
      <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>

      <TouchableOpacity
        style={styles.categoryBadge}
        onPress={openCategory}
        accessibilityRole="link"
        accessibilityLabel={`Browse ${category} recipes in ${scope === 'vault' ? 'My Vault' : 'Community'}`}
      >
        <Text style={styles.categoryText} numberOfLines={1}>{category}</Text>
        <Feather name="chevron-right" size={12} color={colors.primary} />
      </TouchableOpacity>

      {displayedTags.length ? (
        <View style={styles.tags}>
          {displayedTags.map((tag) => {
            const emoji = DIETARY_FILTERS.find((filter) => filter.label === tag)?.emoji;
            return <Text key={tag} style={styles.tag} numberOfLines={1}>{emoji ? `${emoji} ` : ''}{tag}</Text>;
          })}
          {hiddenTagCount ? <Text style={styles.tag}>+{hiddenTagCount}</Text> : null}
        </View>
      ) : null}

      <View style={styles.details}>
        {recipe.author_name ? <Text style={styles.author} numberOfLines={1}>By {recipe.author_name}</Text> : null}
        <Text style={styles.time} numberOfLines={1}>Prep: {recipe.recipe_data?.prep_time_minutes || 0}m • Cook: {recipe.recipe_data?.cook_time_minutes || 0}m</Text>
      </View>

      <View style={styles.scopeBadge}>
        <Feather name={scope === 'community' ? 'globe' : 'lock'} size={12} color={colors.primary} />
        <Text style={styles.scopeText}>{scope === 'community' ? 'Public' : 'My Vault'}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!canDelete) return card;

  return (
    <View style={styles.swipeShadow}>
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={46}
        overshootRight={false}
        enableTrackpadTwoFingerGesture
        containerStyle={styles.swipeContainer}
        childrenContainerStyle={styles.swipeChildren}
        renderRightActions={(_progress, _translation, swipeableMethods) => (
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => {
              swipeableMethods.close();
              onDeleteRequest?.(recipe);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${recipe.title}`}
          >
            <Feather name="trash-2" size={22} color="#FFFFFF" />
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        )}
      >
        {card}
      </ReanimatedSwipeable>
    </View>
  );
}

const createStyles = (colors: AppColors, textScale: number) => createThemedStyles({
  card: {
    flex: 1,
    minHeight: 344,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.secondary,
    ...getShadowStyle('card'),
  },
  cardInSwipeable: { borderWidth: 0, borderRadius: 0, ...Platform.select({ web: { boxShadow: 'none' }, default: { shadowOpacity: 0, elevation: 0 } }) },
  swipeShadow: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...getShadowStyle('card'),
  },
  swipeContainer: { flex: 1, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: colors.secondary },
  swipeChildren: { flex: 1 },
  deleteAction: { width: 96, alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, backgroundColor: colors.danger },
  deleteActionText: { color: '#FFFFFF', fontFamily: TYPOGRAPHY.heading, fontSize: 12 },
  title: { minHeight: 50, fontFamily: TYPOGRAPHY.heading, fontSize: 18, lineHeight: 25, color: colors.textPrimary, marginBottom: SPACING.sm },
  categoryBadge: { maxWidth: '100%', alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.secondary, borderRadius: 999, paddingVertical: 3, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  categoryText: { flexShrink: 1, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 11, color: colors.primary },
  tags: { minHeight: 26, flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  tag: { maxWidth: '100%', fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 10, color: colors.primary, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.secondary, borderRadius: 999, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  details: { marginTop: 'auto' },
  author: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 12, color: colors.primary, marginBottom: 2 },
  time: { fontFamily: TYPOGRAPHY.body, fontSize: 12, color: colors.textSecondary },
  scopeBadge: { alignSelf: 'flex-start', minHeight: 28, marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: 14, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.background, paddingHorizontal: SPACING.sm },
  scopeText: { fontFamily: TYPOGRAPHY.heading, fontSize: 10, color: colors.primary },
}, textScale);
