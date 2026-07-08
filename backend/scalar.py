import re
from fractions import Fraction
from typing import Dict, Any, Tuple

class FractionScalar:
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
                "quantity_fraction": "",
                "unit": ""
            }

        # Find where the number ends so we can parse the rest of the string
        match = self.quantity_pattern.search(ingredient_string.strip())
        text_without_number = ingredient_string.strip()[match.end():]
        
        # Extract the unit and the clean ingredient name
        unit, name = self.parse_unit_and_name(text_without_number)

        scaled_decimal = original_qty * scale_factor
        
        return {
            "name": name.capitalize(), # Capitalize for a cleaner UI
            "quantity_decimal": round(scaled_decimal, 2),
            "quantity_fraction": self.format_fraction(scaled_decimal),
            "unit": unit
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