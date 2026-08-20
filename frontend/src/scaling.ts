import type { IngredientItem } from './types';

export type FormattedMeasurement = {
  quantity: string;
  unit: string;
};

type UnitConversion = {
  unit: string;
  factor: number;
};

const UNIT_ALIASES: Record<string, string> = {
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
  cup: 'cup', cups: 'cup', c: 'cup',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz',
  pint: 'pt', pints: 'pt', pt: 'pt',
  quart: 'qt', quarts: 'qt', qt: 'qt',
  gallon: 'gal', gallons: 'gal', gal: 'gal',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  liter: 'L', liters: 'L', l: 'L',
};

// Only exact, same-dimension conversions are included. Weight-to-volume
// conversions depend on ingredient density and would be misleading here.
const PROMOTION_PATHS: Record<string, UnitConversion[]> = {
  tsp: [{ unit: 'tsp', factor: 1 }, { unit: 'tbsp', factor: 3 }, { unit: 'cup', factor: 48 }],
  tbsp: [{ unit: 'tbsp', factor: 1 }, { unit: 'cup', factor: 16 }],
  'fl oz': [{ unit: 'fl oz', factor: 1 }, { unit: 'cup', factor: 8 }],
  pt: [{ unit: 'pt', factor: 1 }, { unit: 'qt', factor: 2 }, { unit: 'gal', factor: 8 }],
  qt: [{ unit: 'qt', factor: 1 }, { unit: 'gal', factor: 4 }],
  oz: [{ unit: 'oz', factor: 1 }, { unit: 'lb', factor: 16 }],
  g: [{ unit: 'g', factor: 1 }, { unit: 'kg', factor: 1000 }],
  ml: [{ unit: 'ml', factor: 1 }, { unit: 'L', factor: 1000 }],
};

const DEMOTION_PATHS: Record<string, UnitConversion> = {
  cup: { unit: 'tbsp', factor: 16 },
  tbsp: { unit: 'tsp', factor: 3 },
  gal: { unit: 'qt', factor: 4 },
  qt: { unit: 'pt', factor: 2 },
  lb: { unit: 'oz', factor: 16 },
  kg: { unit: 'g', factor: 1000 },
  L: { unit: 'ml', factor: 1000 },
};

const UNIT_DEFINITIONS: Record<string, { dimension: string; factor: number }> = {
  tsp: { dimension: 'us-volume', factor: 1 },
  tbsp: { dimension: 'us-volume', factor: 3 },
  'fl oz': { dimension: 'us-volume', factor: 6 },
  cup: { dimension: 'us-volume', factor: 48 },
  pt: { dimension: 'us-volume', factor: 96 },
  qt: { dimension: 'us-volume', factor: 192 },
  gal: { dimension: 'us-volume', factor: 768 },
  oz: { dimension: 'us-weight', factor: 1 },
  lb: { dimension: 'us-weight', factor: 16 },
  g: { dimension: 'metric-weight', factor: 1 },
  kg: { dimension: 'metric-weight', factor: 1000 },
  ml: { dimension: 'metric-volume', factor: 1 },
  L: { dimension: 'metric-volume', factor: 1000 },
};

export function parseQuantity(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return 0;
  const directNumber = Number(normalizedValue);
  if (Number.isFinite(directNumber)) return directNumber;
  const parts = normalizedValue.split(/\s+/);
  const fraction = parts.pop();
  const [numerator, denominator] = fraction?.split('/').map(Number) ?? [];
  const wholeNumber = parts.length ? Number(parts.join(' ')) : 0;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0 || !Number.isFinite(wholeNumber)) return 0;
  return wholeNumber + numerator / denominator;
}

export function normalizeIngredientForScaling(ingredient: IngredientItem): IngredientItem {
  if (getBaseQuantity(ingredient) > 0 || !ingredient.name) return ingredient;

  const quantityMatch = ingredient.name.trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)/);
  if (!quantityMatch) return ingredient;
  const quantity = parseQuantity(quantityMatch[1]);
  if (quantity <= 0) return ingredient;

  let remaining = ingredient.name.trim().slice(quantityMatch[0].length).trim().replace(/^[,\-]\s*/, '');
  const knownUnits = Object.keys(UNIT_ALIASES).sort((left, right) => right.length - left.length);
  const matchedUnit = knownUnits.find((unit) => remaining.toLowerCase() === unit || remaining.toLowerCase().startsWith(`${unit} `));
  if (matchedUnit) remaining = remaining.slice(matchedUnit.length).trim().replace(/^[,\-]\s*/, '');

  const normalized: IngredientItem = {
    ...ingredient,
    name: remaining || ingredient.name,
    quantity_decimal: quantity,
    base_quantity_decimal: quantity,
    quantity_fraction: quantityMatch[1],
    unit: matchedUnit ?? ingredient.unit,
    // A link saved while this legacy row had no numeric base cannot be
    // interpreted reliably. Start it clean so it cannot distort the recipe.
    manual_overridden: false,
    override_quantity_decimal: undefined,
    override_target_yield: undefined,
  };
  normalized.scaling_type = ingredient.scaling_type ?? getScalingType(normalized);
  return normalized;
}

export function normalizeRecipeIngredients<T extends { recipe_data: { ingredients: IngredientItem[] } }>(recipe: T): T {
  return {
    ...recipe,
    recipe_data: {
      ...recipe.recipe_data,
      ingredients: recipe.recipe_data.ingredients.map(normalizeIngredientForScaling),
    },
  };
}

export function getBaseQuantity(ingredient: IngredientItem) {
  const savedBaseQuantity = Number(ingredient.base_quantity_decimal);
  if (Number.isFinite(savedBaseQuantity) && savedBaseQuantity > 0) return savedBaseQuantity;
  const decimalQuantity = Number(ingredient.quantity_decimal);
  return decimalQuantity > 0 ? decimalQuantity : parseQuantity(ingredient.quantity_fraction);
}

export function getAtomicMultiplier(ingredients: IngredientItem[], targetYield: number) {
  const override = ingredients.find((ingredient) => ingredient.manual_overridden);
  if (!override) return targetYield;
  const baseQuantity = getBaseQuantity(override);
  const overrideQuantity = Number(override.override_quantity_decimal);
  const overrideYield = Number(override.override_target_yield);
  if (baseQuantity <= 0 || overrideQuantity <= 0 || overrideYield <= 0) return targetYield;
  return targetYield * (overrideQuantity / (baseQuantity * overrideYield));
}

export function getScalingType(ingredient: IngredientItem): NonNullable<IngredientItem['scaling_type']> {
  if (ingredient.scaling_type) return ingredient.scaling_type;
  const nameWords = new Set(ingredient.name.toLowerCase().match(/[a-z]+/g) ?? []);
  const unit = ingredient.unit.toLowerCase().trim();
  const continuousUnits = new Set(['cup', 'cups', 'c', 'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'teaspoon', 'teaspoons', 'tsp', 'ounce', 'ounces', 'oz', 'pound', 'pounds', 'lb', 'lbs', 'gram', 'grams', 'g', 'kilogram', 'kilograms', 'kg', 'milliliter', 'milliliters', 'ml', 'liter', 'liters', 'l', 'pint', 'pints', 'pt', 'quart', 'quarts', 'qt', 'gallon', 'gallons', 'gal']);
  if (continuousUnits.has(unit)) return 'continuous';
  if (nameWords.has('loaf') || nameWords.has('loaves')) return 'fractional';
  if (['egg', 'eggs', 'clove', 'cloves', 'banana', 'bananas', 'apple', 'apples', 'avocado', 'avocados', 'lemon', 'lemons', 'lime', 'limes', 'onion', 'onions', 'potato', 'potatoes', 'tomato', 'tomatoes', 'tortilla', 'tortillas'].some((word) => nameWords.has(word))) return 'discrete';
  return 'continuous';
}

export function formatScaledQuantity(ingredient: IngredientItem, multiplier: number) {
  const baseQuantity = getBaseQuantity(ingredient);
  if (!Number.isFinite(baseQuantity) || baseQuantity === 0) return ingredient.quantity_fraction === '0' ? '0' : ingredient.quantity_fraction;
  const scaledQuantity = baseQuantity * multiplier;
  const scalingType = getScalingType(ingredient);
  if (scalingType === 'discrete') return Math.ceil(scaledQuantity).toString();
  if (scalingType === 'fractional') return formatQuarterFraction(Math.round(scaledQuantity * 4) / 4);
  if (usesFractionDisplay(ingredient.unit)) return formatKitchenFraction(scaledQuantity);
  return Number(scaledQuantity.toFixed(2)).toString();
}

export function formatScaledMeasurement(ingredient: IngredientItem, multiplier: number): FormattedMeasurement {
  const baseQuantity = getBaseQuantity(ingredient);
  if (!Number.isFinite(baseQuantity) || baseQuantity === 0) {
    return {
      quantity: ingredient.quantity_fraction === '0' ? '0' : ingredient.quantity_fraction,
      unit: ingredient.unit,
    };
  }
  const scaledQuantity = baseQuantity * multiplier;
  const scalingType = getScalingType(ingredient);
  if (scalingType === 'discrete') return { quantity: Math.ceil(scaledQuantity).toString(), unit: ingredient.unit };
  if (scalingType === 'fractional') return { quantity: formatQuarterFraction(Math.round(scaledQuantity * 4) / 4), unit: ingredient.unit };

  const converted = convertToReadableUnit(scaledQuantity, ingredient.unit);
  return {
    quantity: usesFractionDisplay(converted.unit)
      ? formatKitchenFraction(converted.quantity)
      : Number(converted.quantity.toFixed(2)).toString(),
    unit: converted.unit,
  };
}

export function formatEquivalentMeasurement(ingredient: IngredientItem, multiplier: number): FormattedMeasurement | null {
  if (getScalingType(ingredient) !== 'continuous') return null;
  const baseQuantity = getBaseQuantity(ingredient);
  if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) return null;
  const converted = convertToReadableUnit(baseQuantity * multiplier, ingredient.unit);
  if (converted.unit === ingredient.unit) return null;
  return {
    quantity: usesFractionDisplay(converted.unit)
      ? formatKitchenFraction(converted.quantity)
      : Number(converted.quantity.toFixed(2)).toString(),
    unit: converted.unit,
  };
}

export function convertToReadableUnit(quantity: number, unit: string) {
  const normalizedUnit = UNIT_ALIASES[unit.toLowerCase().trim()];
  if (!normalizedUnit || !Number.isFinite(quantity) || quantity <= 0) return { quantity, unit };

  const promotionPath = PROMOTION_PATHS[normalizedUnit];
  if (promotionPath) {
    let best = promotionPath[0];
    for (const candidate of promotionPath) {
      const candidateQuantity = quantity / candidate.factor;
      if (candidateQuantity >= 1 && canDisplayWithoutExtraRounding(candidateQuantity, candidate.unit)) best = candidate;
    }
    if (best.unit !== normalizedUnit) return { quantity: quantity / best.factor, unit: best.unit };
  }

  // Tiny fractions are clearer in the next smaller unit (for example,
  // 1/16 cup becomes 1 tbsp). Normal kitchen fractions remain unchanged.
  if (quantity < 0.125) {
    const smaller = DEMOTION_PATHS[normalizedUnit];
    if (smaller) return { quantity: quantity * smaller.factor, unit: smaller.unit };
  }

  return { quantity, unit };
}

function canDisplayWithoutExtraRounding(quantity: number, unit: string) {
  const precision = usesFractionDisplay(unit) ? 8 : 100;
  return Math.abs(quantity * precision - Math.round(quantity * precision)) < 0.000001;
}

export function convertMeasurementUnit(quantity: number, fromUnit: string, toUnit: string) {
  const normalizedFrom = UNIT_ALIASES[fromUnit.toLowerCase().trim()];
  const normalizedTo = UNIT_ALIASES[toUnit.toLowerCase().trim()];
  const fromDefinition = normalizedFrom ? UNIT_DEFINITIONS[normalizedFrom] : undefined;
  const toDefinition = normalizedTo ? UNIT_DEFINITIONS[normalizedTo] : undefined;
  if (!fromDefinition || !toDefinition || fromDefinition.dimension !== toDefinition.dimension) return quantity;
  return quantity * fromDefinition.factor / toDefinition.factor;
}

export function formatEditableQuantity(quantity: number) {
  return Number(quantity.toFixed(2)).toString();
}

export function normalizeManualAmount(amount: number, scalingType: NonNullable<IngredientItem['scaling_type']>) {
  if (scalingType === 'discrete') return Math.ceil(amount);
  if (scalingType === 'fractional') return Math.round(amount * 4) / 4;
  return Number(amount.toFixed(2));
}

function formatQuarterFraction(quantity: number) {
  const wholeNumber = Math.floor(quantity);
  const quarter = Math.round((quantity - wholeNumber) * 4);
  if (quarter === 0) return wholeNumber.toString();
  if (quarter === 4) return (wholeNumber + 1).toString();
  const fraction = ['1/4', '1/2', '3/4'][quarter - 1];
  return wholeNumber ? `${wholeNumber} ${fraction}` : fraction ?? quantity.toString();
}

function usesFractionDisplay(unit: string) {
  return new Set(['cup', 'cups', 'c', 'tablespoon', 'tablespoons', 'tbsp', 'tbs', 'teaspoon', 'teaspoons', 'tsp', 'pt', 'pint', 'pints', 'qt', 'quart', 'quarts', 'gal', 'gallon', 'gallons']).has(unit.toLowerCase().trim());
}

function formatKitchenFraction(quantity: number) {
  const roundedToEighth = Math.round(quantity * 8) / 8;
  const wholeNumber = Math.floor(roundedToEighth);
  const eighths = Math.round((roundedToEighth - wholeNumber) * 8);
  if (eighths === 0) return wholeNumber.toString();
  if (eighths === 8) return (wholeNumber + 1).toString();
  const fractions = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
  const fraction = fractions[eighths];
  return wholeNumber ? `${wholeNumber} ${fraction}` : fraction;
}

export function scalingTypeLabel(scalingType: NonNullable<IngredientItem['scaling_type']>) {
  if (scalingType === 'discrete') return 'Whole item — rounded up';
  if (scalingType === 'fractional') return 'Rounded to the nearest quarter';
  return 'Scales continuously';
}
