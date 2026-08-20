export const DIETARY_FILTERS = [
  { label: 'Vegetarian', emoji: '🥦' },
  { label: 'Vegan', emoji: '🌱' },
  { label: 'Gluten-Free', emoji: '🌾' },
  { label: 'Dairy-Free', emoji: '🥛' },
  { label: 'Egg-Free', emoji: '🥚' },
  { label: 'Nut-Free', emoji: '🥜' },
  { label: 'Pescatarian', emoji: '🐟' },
  { label: 'Keto', emoji: '🥑' },
  { label: 'Paleo', emoji: '🍖' },
  { label: 'Low-Carb', emoji: '📉' },
] as const;

export const DIETARY_LABELS = DIETARY_FILTERS.map(({ label }) => label);
