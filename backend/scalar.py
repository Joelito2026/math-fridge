import re
import math
from fractions import Fraction
from typing import Dict, Any, Tuple

class FractionScalar:
    SCALING_TYPES = {"continuous", "discrete", "fractional"}
    DISCRETE_TERMS = {
        "egg", "eggs", "clove", "cloves", "banana", "bananas", "apple", "apples",
        "avocado", "avocados", "lemon", "lemons", "lime", "limes", "onion", "onions",
        "potato", "potatoes", "tomato", "tomatoes", "tortilla", "tortillas",
    }
    FRACTIONAL_TERMS = {"loaf", "loaves"}
    # Our Source of Truth for valid kitchen measurements
    STANDARD_UNITS = [
        "cup", "cups", "c",
        "tablespoon", "tablespoons", "tbsp", "tbs",
        "teaspoon", "teaspoons", "tsp",
        "ounce", "ounces", "oz",
        "pound", "pounds", "lb", "lbs",
        "gram", "grams", "g",
        "kilogram", "kilograms", "kg",
        "milliliter", "milliliters", "ml",
        "liter", "liters", "l",
        "pint", "pints", "pt",
        "quart", "quarts", "qt",
        "gallon", "gallons", "gal",
        "fluid ounce", "fluid ounces", "fl oz",
        "dash", "pinch", "drop"
    ]

    def __init__(self):
        # 1. Matches the leading number (e.g., "1", "1/2", "1 1/2")
        self.quantity_pattern = re.compile(r'^(\d+\s+\d+/\d+|\d+/\d+|\d+\.?\d*)')
        
        # 2. Dynamically builds a regex to catch any unit in our list right after the number
        # Looks for the unit, followed by a space or the end of the string
        units_joined = '|'.join(self.STANDARD_UNITS)
        self.unit_pattern = re.compile(rf'^\s*({units_joined})\b', re.IGNORECASE)

    def parse_quantity(self, ingredient_string: str) -> float:
        """Extracts the leading number from an ingredient string."""
        match = self.quantity_pattern.search(ingredient_string.strip())
        if not match:
            return 0.0 
            
        raw_qty = match.group(1)
        if " " in raw_qty:
            whole, frac = raw_qty.split(" ")
            return float(int(whole) + Fraction(frac))
        
        return float(Fraction(raw_qty))

    def format_fraction(self, decimal_value: float) -> str:
        """Converts a scaled float back into a readable kitchen fraction."""
        if decimal_value == 0:
            return ""
            
        frac = Fraction(decimal_value).limit_denominator(8)
        whole = frac.numerator // frac.denominator
        remainder = frac.numerator % frac.denominator
        
        if remainder == 0:
            return str(whole)
        elif whole == 0:
            return f"{remainder}/{frac.denominator}"
        else:
            return f"{whole} {remainder}/{frac.denominator}"

    def parse_unit_and_name(self, text_without_number: str) -> Tuple[str, str]:
        """
        Hunts for a known unit at the beginning of the remaining string.
        Returns the (unit, cleaned_ingredient_name).
        """
        # Clean leading whitespace and commas
        clean_text = text_without_number.lstrip(' ,-')
        
        match = self.unit_pattern.search(clean_text)
        if match:
            unit = match.group(1).lower()
            # Strip the unit out of the string to leave just the ingredient name
            name = clean_text[match.end():].strip(' ,-')
            return unit, name
            
        # If no standard unit is found (e.g., "2 large eggs"), return blank unit and the whole string
        return "", clean_text

    def classify_ingredient(self, unit: str, name: str) -> str:
        """Choose the safest scaling behavior from structured ingredient data."""
        normalized_unit = unit.lower().strip()
        normalized_name = name.lower()
        words = set(re.findall(r"[a-z]+", normalized_name))

        # A measurable unit always takes precedence (for example, a cup of eggs).
        if normalized_unit in self.STANDARD_UNITS:
            return "continuous"
        if words & self.FRACTIONAL_TERMS:
            return "fractional"
        if words & self.DISCRETE_TERMS:
            return "discrete"
        return "continuous"

    def scale_quantity(self, quantity: float, scale_factor: float, scaling_type: str) -> float:
        scaled_quantity = quantity * scale_factor
        if scaling_type == "discrete":
            return float(math.ceil(scaled_quantity))
        if scaling_type == "fractional":
            return round(scaled_quantity * 4) / 4
        return round(scaled_quantity, 2)

    def normalize_ingredient(self, ingredient: Dict[str, Any]) -> Dict[str, Any]:
        """Preserve a selected category or classify legacy ingredient records."""
        normalized = ingredient.copy()
        scaling_type = normalized.get("scaling_type")
        if scaling_type not in self.SCALING_TYPES:
            scaling_type = self.classify_ingredient(
                str(normalized.get("unit", "")),
                str(normalized.get("name", "")),
            )
        normalized["scaling_type"] = scaling_type
        base_quantity = normalized.get("base_quantity_decimal")
        if not isinstance(base_quantity, (int, float)):
            decimal_quantity = normalized.get("quantity_decimal")
            if isinstance(decimal_quantity, (int, float)) and decimal_quantity > 0:
                base_quantity = decimal_quantity
            else:
                base_quantity = self.parse_quantity(str(normalized.get("quantity_fraction", "")))
        normalized["base_quantity_decimal"] = float(base_quantity)
        normalized["manual_overridden"] = bool(normalized.get("manual_overridden", False))
        return normalized

    def scale_ingredient(self, ingredient_string: str, scale_factor: float) -> Dict[str, Any]:
        """
        The main worker: takes a raw string, extracts the math, separates the unit,
        scales it, and returns the structured data for the database.
        """
        original_qty = self.parse_quantity(ingredient_string)
        
        if original_qty == 0.0:
            return {
                "name": ingredient_string.strip(),
                "quantity_decimal": 0.0,
                "base_quantity_decimal": 0.0,
                "quantity_fraction": "",
                "unit": "",
                "scaling_type": self.classify_ingredient("", ingredient_string),
                "manual_overridden": False,
            }

        # Find where the number ends so we can parse the rest of the string
        match = self.quantity_pattern.search(ingredient_string.strip())
        text_without_number = ingredient_string.strip()[match.end():]
        
        # Extract the unit and the clean ingredient name
        unit, name = self.parse_unit_and_name(text_without_number)

        scaling_type = self.classify_ingredient(unit, name)
        scaled_decimal = self.scale_quantity(original_qty, scale_factor, scaling_type)
        
        return {
            "name": name.capitalize(), # Capitalize for a cleaner UI
            "quantity_decimal": scaled_decimal,
            "base_quantity_decimal": original_qty,
            "quantity_fraction": self.format_fraction(scaled_decimal),
            "unit": unit,
            "scaling_type": scaling_type,
            "manual_overridden": False,
        }

# --- Quick Local Sandbox Test ---
if __name__ == "__main__":
    scalar = FractionScalar()
    
    # Testing a variety of edge cases
    test_strings = [
        "1 1/2 cups butter, softened",
        "0.5 teaspoon salt",
        "2 large eggs",  # No unit, just a number and a noun
        "Salt and pepper to taste" # No number at all
    ]
    
    print("--- SCALAR ENGINE TEST ---")
    for test in test_strings:
        print(f"\nRaw String: {test}")
        print(scalar.scale_ingredient(test, scale_factor=2.0))
