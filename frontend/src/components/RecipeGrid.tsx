import { ReactElement, useMemo } from 'react';
import { FlatList, StyleProp, useWindowDimensions, View, ViewStyle } from 'react-native';

import { SPACING } from '../theme';
import { RecipeResponse } from '../types';
import RecipeCard from './RecipeCard';

type RecipeGridProps = {
  recipes: RecipeResponse[];
  scope: 'community' | 'vault';
  onDeleteRequest?: (recipe: RecipeResponse) => void;
  emptyComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export default function RecipeGrid({ recipes, scope, onDeleteRequest, emptyComponent, contentContainerStyle }: RecipeGridProps) {
  const { width } = useWindowDimensions();
  const columns = width >= 960 ? 3 : width >= 620 ? 2 : 1;
  const cardWidth = useMemo(() => {
    const availableWidth = Math.max(0, Math.min(width, 1250) - SPACING.lg * 2);
    return Math.max(0, (availableWidth - SPACING.md * (columns - 1)) / columns);
  }, [columns, width]);

  return (
    <FlatList
      key={`recipe-grid-${columns}`}
      data={recipes}
      keyExtractor={(item) => item.id}
      numColumns={columns}
      renderItem={({ item }) => <View style={{ width: cardWidth, alignSelf: 'stretch' }}><RecipeCard recipe={item} scope={scope} onDeleteRequest={onDeleteRequest} /></View>}
      columnWrapperStyle={columns > 1 ? { gap: SPACING.lg } : undefined}
      contentContainerStyle={[{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, gap: SPACING.lg }, contentContainerStyle]}
      ListEmptyComponent={emptyComponent}
    />
  );
}
