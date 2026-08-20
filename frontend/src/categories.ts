export type CategoryDirectoryKey = 'cuisines' | 'mealTypes' | 'seasonal' | 'categories' | 'ingredients';

export type CategoryGroup = {
  key: CategoryDirectoryKey;
  title: string;
  directoryTitle: string;
  directorySubtitle: string;
  allLabel: string;
  featuredTags: readonly string[];
  tags: readonly string[];
};

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    key: 'cuisines',
    title: 'Cuisine',
    directoryTitle: 'Cuisines Around the World',
    directorySubtitle: 'Explore regional and cultural cooking traditions from across the globe.',
    allLabel: 'All Cuisines',
    featuredTags: ['Italian', 'Greek', 'French', 'American', 'Mexican', 'Indian', 'Filipino', 'Chinese', 'Japanese', 'Korean'],
    tags: [
      'Afghan', 'Algerian', 'American', 'Argentinian', 'Armenian', 'Australian', 'Austrian', 'Bangladeshi',
      'Belgian', 'Brazilian', 'British', 'Burmese', 'Cajun & Creole', 'Cambodian', 'Canadian', 'Caribbean',
      'Central American', 'Chilean', 'Chinese', 'Colombian', 'Croatian', 'Cuban', 'Czech', 'Danish',
      'Dominican', 'Dutch', 'Egyptian', 'Eritrean', 'Ethiopian', 'Fijian', 'Filipino', 'Finnish', 'French',
      'Georgian', 'German', 'Ghanaian', 'Greek', 'Haitian', 'Hawaiian', 'Hungarian', 'Icelandic', 'Indian',
      'Indonesian', 'Iraqi', 'Irish', 'Israeli', 'Italian', 'Jamaican', 'Japanese', 'Jordanian', 'Kenyan',
      'Korean', 'Laotian', 'Latin American', 'Lebanese', 'Malaysian', 'Māori', 'Mediterranean', 'Mexican',
      'Middle Eastern', 'Mongolian', 'Moroccan', 'Nepalese', 'New Zealand', 'Nigerian', 'Norwegian',
      'Pakistani', 'Palestinian', 'Persian', 'Peruvian', 'Polish', 'Polynesian', 'Portuguese', 'Puerto Rican',
      'Québécois', 'Romanian', 'Russian', 'Samoan', 'Senegalese', 'Serbian', 'Singaporean', 'Somali',
      'South African', 'Southern', 'Spanish', 'Sri Lankan', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese',
      'Tex-Mex', 'Thai', 'Tibetan', 'Trinidadian & Tobagonian', 'Tunisian', 'Turkish', 'Ukrainian',
      'Uzbek', 'Venezuelan', 'Vietnamese', 'West African', 'Jewish', 'Fusion',
    ],
  },
  {
    key: 'mealTypes',
    title: 'Meal Type',
    directoryTitle: 'All Meal Types',
    directorySubtitle: 'Browse recipes by mealtime, occasion, or the way you plan to serve them.',
    allLabel: 'All Meal Types',
    featuredTags: ['Breakfast', 'Snack', 'Brunch', 'Lunch', 'Dinner'],
    tags: ['Afternoon Tea', 'Appetizer', 'Breakfast', 'Brunch', 'Dessert', 'Dinner', 'Drinks', 'Late-Night', 'Lunch', 'Picnic', 'Potluck', 'Snack', 'Supper'],
  },
  {
    key: 'seasonal',
    title: 'Seasonal',
    directoryTitle: 'Seasonal Collections',
    directorySubtitle: 'Find recipes suited to the season, holidays, and the moments people gather around food.',
    allLabel: 'All Seasonal',
    featuredTags: ['Fresh Spring Recipes', 'Summer Grilling', 'Summer Favorites', 'Cozy Fall Soups', 'Fall Comfort Food', 'Hearty Winter Meals', 'Holiday Baking', 'Game Day Favorites', 'Slow Cooker Season', 'Light & Fresh Meals'],
    tags: ['Fresh Spring Recipes', 'Spring Celebrations', 'Summer Grilling', 'Summer Favorites', 'Picnic Season', 'Back-to-School', 'Cozy Fall Soups', 'Fall Comfort Food', 'Apple Season', 'Pumpkin Season', 'Hearty Winter Meals', 'Holiday Baking', 'Holiday Entertaining', 'Game Day Favorites', 'Slow Cooker Season', 'Light & Fresh Meals'],
  },
  {
    key: 'categories',
    title: 'Dish Category',
    directoryTitle: 'All Recipe Categories',
    directorySubtitle: 'Explore recipes by dish, cooking style, and the form the finished food takes.',
    allLabel: 'All Categories',
    featuredTags: ['Appetizers', 'Bread', 'Snacks', 'Pasta', 'Salad', 'Dessert', 'Soup', 'Main Dishes', 'Drinks'],
    tags: ['Appetizers', 'Baking', 'Bread', 'Breakfast Dishes', 'Burgers', 'Casseroles', 'Condiments', 'Dessert', 'Drinks', 'Main Dishes', 'One-Pot Meals', 'Pasta', 'Pizza', 'Salad', 'Sandwiches', 'Sauces', 'Side Dishes', 'Snacks', 'Soup', 'Stews', 'Tacos & Wraps'],
  },
  {
    key: 'ingredients',
    title: 'Ingredient',
    directoryTitle: 'Browse by Ingredient',
    directorySubtitle: 'Start with what you have and discover recipes built around a favorite ingredient family.',
    allLabel: 'All Ingredients',
    featuredTags: ['Fruits', 'Vegetables', 'Dairy', 'Seafood', 'Poultry', 'Beef', 'Pork', 'Grains & Rice', 'Legumes'],
    tags: ['Beef', 'Chocolate', 'Dairy', 'Eggs', 'Fruits', 'Grains & Rice', 'Herbs & Spices', 'Lamb', 'Legumes', 'Mushrooms', 'Nuts & Seeds', 'Pasta & Noodles', 'Pork', 'Poultry', 'Seafood', 'Tofu & Tempeh', 'Vegetables'],
  },
] as const;

export const CATEGORY_TAGS = ['Popular', ...CATEGORY_GROUPS.flatMap(({ tags }) => tags)] as string[];

export function getCategoryGroup(key: CategoryDirectoryKey) {
  return CATEGORY_GROUPS.find((group) => group.key === key)!;
}

export function matchesCategory(recipe: { category?: string; category_tags?: string[] }, requestedName: string) {
  const recipeTags = recipe.category_tags?.length ? recipe.category_tags : [recipe.category || 'Popular'];
  return recipeTags.some((tag) => tag.toLowerCase() === requestedName.toLowerCase());
}
