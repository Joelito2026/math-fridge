import type { IngredientItem } from '../../src/types';
import {
  convertMeasurementUnit,
  convertToReadableUnit,
  formatEquivalentMeasurement,
  formatScaledMeasurement,
  formatScaledQuantity,
  getAtomicMultiplier,
  getScalingType,
  normalizeIngredientForScaling,
  normalizeManualAmount,
  parseQuantity,
} from '../../src/scaling';

function ingredient(overrides: Partial<IngredientItem> = {}): IngredientItem {
  return {
    name: 'Flour',
    quantity_decimal: 1,
    quantity_fraction: '1',
    unit: 'cup',
    ...overrides,
  };
}

describe('quantity parsing', () => {
  test.each([
    ['2', 2],
    ['1.5', 1.5],
    ['3/4', 0.75],
    ['1 1/2', 1.5],
    [' 2 3/4 ', 2.75],
  ])('parses %s as %s', (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  test.each(['', 'not a quantity', '1/0', 'one half'])('safely rejects invalid input: %s', (input) => {
    expect(parseQuantity(input)).toBe(0);
  });
});

describe('ingredient classification', () => {
  test('classifies measured ingredients as continuous', () => {
    expect(getScalingType(ingredient({ name: 'Eggs', unit: 'cups' }))).toBe('continuous');
  });

  test.each(['Egg', 'garlic cloves', 'bananas', 'corn tortillas'])('classifies %s as discrete', (name) => {
    expect(getScalingType(ingredient({ name, unit: 'each' }))).toBe('discrete');
  });

  test('classifies loaves as fractional', () => {
    expect(getScalingType(ingredient({ name: 'Bread loaves', unit: 'loaf' }))).toBe('fractional');
  });

  test('honors an explicitly saved scaling type', () => {
    expect(getScalingType(ingredient({ name: 'Apple', unit: 'each', scaling_type: 'continuous' }))).toBe('continuous');
  });
});

describe('scaled quantities', () => {
  test('rounds discrete ingredients up to a whole item', () => {
    const eggs = ingredient({ name: 'Eggs', unit: 'each', quantity_decimal: 2, quantity_fraction: '2' });
    expect(formatScaledQuantity(eggs, 1.2)).toBe('3');
  });

  test('rounds fractional ingredients to the nearest quarter', () => {
    const bread = ingredient({ name: 'Bread loaf', unit: 'loaf', quantity_decimal: 1, quantity_fraction: '1' });
    expect(formatScaledQuantity(bread, 1.6)).toBe('1 1/2');
  });

  test('displays kitchen units as readable fractions', () => {
    expect(formatScaledQuantity(ingredient({ quantity_decimal: 0.5, quantity_fraction: '1/2' }), 1.5)).toBe('3/4');
  });

  test('keeps decimal precision reasonable for metric ingredients', () => {
    const flour = ingredient({ quantity_decimal: 125.125, quantity_fraction: '125.125', unit: 'g' });
    expect(formatScaledQuantity(flour, 2)).toBe('250.25');
  });

  test('preserves the original display when no numeric quantity exists', () => {
    const salt = ingredient({ quantity_decimal: 0, quantity_fraction: 'to taste', unit: '' });
    expect(formatScaledQuantity(salt, 3)).toBe('to taste');
  });
});

describe('unit conversions', () => {
  test.each([
    [48, 'tsp', 1, 'cup'],
    [16, 'tbsp', 1, 'cup'],
    [32, 'oz', 2, 'lb'],
    [2000, 'g', 2, 'kg'],
    [2000, 'ml', 2, 'L'],
  ] as const)('promotes %s %s to %s %s', (quantity, unit, expectedQuantity, expectedUnit) => {
    expect(convertToReadableUnit(quantity, unit)).toEqual({ quantity: expectedQuantity, unit: expectedUnit });
  });

  test('demotes an unreadably small cup measurement', () => {
    expect(convertToReadableUnit(1 / 16, 'cup')).toEqual({ quantity: 1, unit: 'tbsp' });
  });

  test('converts within the same measurement dimension', () => {
    expect(convertMeasurementUnit(2, 'cups', 'tbsp')).toBe(32);
  });

  test('does not invent a density conversion between volume and weight', () => {
    expect(convertMeasurementUnit(2, 'cups', 'grams')).toBe(2);
  });

  test('leaves unknown units unchanged', () => {
    expect(convertToReadableUnit(3, 'pinches')).toEqual({ quantity: 3, unit: 'pinches' });
  });

  test('provides an equivalent measurement only when a conversion is useful', () => {
    const teaspoons = ingredient({ quantity_decimal: 48, quantity_fraction: '48', unit: 'tsp' });
    expect(formatEquivalentMeasurement(teaspoons, 1)).toEqual({ quantity: '1', unit: 'cup' });
    expect(formatEquivalentMeasurement(ingredient(), 1)).toBeNull();
  });
});

describe('atomic scaling and manual overrides', () => {
  test('uses the target yield when no ingredient is linked', () => {
    expect(getAtomicMultiplier([ingredient()], 2.5)).toBe(2.5);
  });

  test('uses a valid linked ingredient as the recipe ratio anchor', () => {
    const linked = ingredient({
      base_quantity_decimal: 2,
      manual_overridden: true,
      override_quantity_decimal: 3,
      override_target_yield: 1.5,
    });
    expect(getAtomicMultiplier([linked], 2)).toBe(2);
  });

  test('falls back safely when override data is incomplete', () => {
    const invalidOverride = ingredient({ manual_overridden: true, override_quantity_decimal: 0 });
    expect(getAtomicMultiplier([invalidOverride], 3)).toBe(3);
  });

  test.each([
    [2.4, 'discrete', 3],
    [1.62, 'fractional', 1.5],
    [1.236, 'continuous', 1.24],
  ] as const)('normalizes %s as %s to %s', (amount, type, expected) => {
    expect(normalizeManualAmount(amount, type)).toBe(expected);
  });
});

describe('legacy ingredient normalization', () => {
  test('extracts a mixed quantity and unit from an old ingredient name', () => {
    const normalized = normalizeIngredientForScaling(ingredient({
      name: '1 1/2 cups flour',
      quantity_decimal: 0,
      quantity_fraction: '',
      unit: '',
      manual_overridden: true,
    }));

    expect(normalized).toMatchObject({
      name: 'flour',
      quantity_decimal: 1.5,
      base_quantity_decimal: 1.5,
      quantity_fraction: '1 1/2',
      unit: 'cups',
      scaling_type: 'continuous',
      manual_overridden: false,
    });
  });

  test('does not damage an ingredient without a recognizable quantity', () => {
    const original = ingredient({ name: 'Salt to taste', quantity_decimal: 0, quantity_fraction: '', unit: '' });
    expect(normalizeIngredientForScaling(original)).toBe(original);
  });

  test('formats a converted scaled measurement end to end', () => {
    const butter = ingredient({ name: 'Butter', quantity_decimal: 8, quantity_fraction: '8', unit: 'tbsp' });
    expect(formatScaledMeasurement(butter, 2)).toEqual({ quantity: '1', unit: 'cup' });
  });
});
