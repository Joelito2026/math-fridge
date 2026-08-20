import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { CATEGORY_GROUPS } from '../categories';
import { DIETARY_FILTERS } from '../dietary';
import { AppColors, usePreferences } from '../contexts/PreferencesContext';
import { SPACING, TYPOGRAPHY } from '../theme';
import { createThemedStyles } from '../theme/createThemedStyles';

type Props = {
  categoryTags: string[];
  dietaryTags: string[];
  onCategoryTagsChange: (tags: string[]) => void;
  onDietaryTagsChange: (tags: string[]) => void;
  showWarning?: boolean;
};

export default function RecipeTagEditor({ categoryTags, dietaryTags, onCategoryTagsChange, onDietaryTagsChange, showWarning = true }: Props) {
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const toggleTag = (tags: string[], tag: string, onChange: (next: string[]) => void) => {
    onChange(tags.includes(tag) ? tags.filter((selected) => selected !== tag) : [...tags, tag]);
  };

  return <View style={styles.container}>
    <View style={styles.group}>
      <Text style={styles.groupTitle}>General</Text>
      <View style={styles.chips}><TagChip label="Popular" selected={categoryTags.includes('Popular')} onPress={() => toggleTag(categoryTags, 'Popular', onCategoryTagsChange)} styles={styles} /></View>
    </View>

    {CATEGORY_GROUPS.map(({ title, allLabel, featuredTags, tags }) => {
      const expanded = expandedGroups.includes(title);
      const selectedExtras = categoryTags.filter((tag) => tags.includes(tag));
      const visibleTags = expanded ? tags : Array.from(new Set([...featuredTags, ...selectedExtras]));
      return <View key={title} style={styles.group}>
        <View style={styles.groupHeading}>
          <Text style={styles.groupTitle}>{title}</Text>
          <TouchableOpacity onPress={() => setExpandedGroups((current) => expanded ? current.filter((group) => group !== title) : [...current, title])} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${expanded ? 'Show featured' : 'Show'} ${allLabel.toLowerCase()}`}>
            <Text style={styles.allButtonText}>{expanded ? 'Featured only' : allLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chips}>{visibleTags.map((label) => <TagChip key={label} label={label} selected={categoryTags.includes(label)} onPress={() => toggleTag(categoryTags, label, onCategoryTagsChange)} styles={styles} />)}</View>
      </View>;
    })}

    <View style={styles.group}>
      <Text style={styles.groupTitle}>Dietary</Text>
      <View style={styles.chips}>{DIETARY_FILTERS.map(({ label, emoji }) => <TagChip key={label} label={`${emoji} ${label}`} selected={dietaryTags.includes(label)} onPress={() => toggleTag(dietaryTags, label, onDietaryTagsChange)} styles={styles} accessibilityLabel={`${label} dietary tag`} />)}</View>
    </View>
    {showWarning ? <Text style={styles.warning}>AI suggestions are informational. Review tags after changing ingredients, especially for allergies and dietary restrictions.</Text> : null}
  </View>;
}

function TagChip({ label, selected, onPress, styles, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; styles: any; accessibilityLabel?: string }) {
  return <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={accessibilityLabel || `${label} category`}>
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>;
}

const createStyles = (colors: AppColors, textScale: number) => createThemedStyles({
  container: { width: '100%' },
  group: { width: '100%', marginTop: SPACING.lg },
  groupHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  groupTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: colors.textPrimary },
  allButtonText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: colors.primary, paddingVertical: SPACING.xs },
  chips: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  chip: { minHeight: 40, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.background, paddingHorizontal: SPACING.md },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: colors.textPrimary },
  chipTextSelected: { color: colors.background },
  warning: { fontFamily: TYPOGRAPHY.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary, marginTop: SPACING.lg },
}, textScale);
