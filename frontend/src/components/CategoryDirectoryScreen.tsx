import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryDirectoryKey, getCategoryGroup } from '../categories';
import { AppColors, usePreferences } from '../contexts/PreferencesContext';
import { SPACING, TYPOGRAPHY } from '../theme';
import { createThemedStyles } from '../theme/createThemedStyles';

type Props = { groupKey: CategoryDirectoryKey };

export default function CategoryDirectoryScreen({ groupKey }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, textScale } = usePreferences();
  const styles = createStyles(colors, textScale);
  const group = getCategoryGroup(groupKey);
  const [query, setQuery] = useState('');
  const columns = width >= 1050 ? 4 : width >= 650 ? 2 : 1;
  const filteredTags = useMemo(() => group.tags.filter((tag) => tag.toLowerCase().includes(query.trim().toLowerCase())), [group.tags, query]);

  const openCategory = (name: string) => router.push({ pathname: '/category/[name]', params: { name, scope: 'community' } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['right', 'bottom', 'left']}>
      <Stack.Screen options={{ title: group.directoryTitle }} />
      <View style={styles.shell}>
        <View style={styles.actionArea}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Feather name="arrow-left" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          key={columns}
          data={filteredTags}
          numColumns={columns}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={columns > 1 ? styles.columnRow : undefined}
          ListHeaderComponent={<>
            <Text style={styles.title}>{group.directoryTitle}</Text>
            <Text style={styles.subtitle}>{group.directorySubtitle}</Text>

            <Text style={styles.sectionTitle}>Featured</Text>
            <View style={styles.featuredRow}>
              {group.featuredTags.map((tag) => <TouchableOpacity key={tag} style={styles.featuredChip} onPress={() => openCategory(tag)} accessibilityRole="link" accessibilityLabel={`Browse ${tag} recipes`}>
                <Text style={styles.featuredText}>{tag}</Text><Feather name="arrow-up-right" size={13} color={colors.background} />
              </TouchableOpacity>)}
            </View>

            <View style={styles.directoryHeading}>
              <Text style={styles.sectionTitle}>All available</Text>
              <Text style={styles.countText}>{filteredTags.length} {filteredTags.length === 1 ? 'option' : 'options'}</Text>
            </View>
            <View style={styles.searchBox}>
              <Feather name="search" size={19} color={colors.textSecondary} />
              <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder={`Search ${group.title.toLowerCase()}…`} placeholderTextColor={colors.textSecondary} autoCorrect={false} accessibilityLabel={`Search ${group.title}`} />
              {query ? <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search"><Feather name="x-circle" size={19} color={colors.textSecondary} /></TouchableOpacity> : null}
            </View>
          </>}
          renderItem={({ item }) => <View style={styles.itemCell}>
            <TouchableOpacity style={styles.directoryItem} onPress={() => openCategory(item)} accessibilityRole="link" accessibilityLabel={`Browse ${item} recipes`}>
              <Text style={styles.directoryItemText}>{item}</Text>
              <Feather name="chevron-right" size={17} color={colors.primary} />
            </TouchableOpacity>
          </View>}
          ListEmptyComponent={<Text style={styles.emptyText}>No options match “{query}”.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors, textScale: number) => createThemedStyles({
  safeArea: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, width: '100%', maxWidth: 1250, alignSelf: 'center' },
  actionArea: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  backButton: { alignSelf: 'flex-start', minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: 22, borderWidth: 1, borderColor: colors.secondary, backgroundColor: colors.surface, paddingHorizontal: SPACING.md },
  backText: { fontFamily: TYPOGRAPHY.heading, fontSize: 15, color: colors.primary },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  title: { fontFamily: TYPOGRAPHY.heading, fontSize: 32, color: colors.textPrimary, marginTop: SPACING.lg },
  subtitle: { fontFamily: TYPOGRAPHY.body, fontSize: 16, lineHeight: 23, color: colors.textSecondary, maxWidth: 720, marginTop: SPACING.xs },
  sectionTitle: { fontFamily: TYPOGRAPHY.heading, fontSize: 17, color: colors.textPrimary, marginTop: SPACING.lg },
  featuredRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  featuredChip: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 19, backgroundColor: colors.primary, paddingHorizontal: SPACING.md },
  featuredText: { fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 13, color: colors.background },
  directoryHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.md, marginTop: SPACING.md },
  countText: { fontFamily: TYPOGRAPHY.body, fontSize: 13, color: colors.textSecondary },
  searchBox: { height: 48, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: colors.secondary, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.md },
  searchInput: { flex: 1, height: '100%', fontFamily: TYPOGRAPHY.body, fontSize: 15, color: colors.textPrimary },
  columnRow: { gap: SPACING.sm },
  itemCell: { flex: 1, minWidth: 0, marginBottom: SPACING.sm },
  directoryItem: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, borderWidth: 1, borderColor: colors.secondary, borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: SPACING.md },
  directoryItemText: { flex: 1, fontFamily: TYPOGRAPHY.bodyMedium, fontSize: 14, color: colors.textPrimary },
  emptyText: { fontFamily: TYPOGRAPHY.body, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.xl },
}, textScale);
