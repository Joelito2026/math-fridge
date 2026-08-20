import unittest

from scalar import FractionScalar


class FractionScalarTests(unittest.TestCase):
    def setUp(self):
        self.scalar = FractionScalar()

    def test_discrete_ingredients_round_up(self):
        scaled = self.scalar.scale_ingredient("2 eggs", 1.2)
        self.assertEqual(scaled["scaling_type"], "discrete")
        self.assertEqual(scaled["quantity_decimal"], 3.0)

    def test_fractional_ingredients_round_to_quarters(self):
        scaled = self.scalar.scale_ingredient("1 loaf bread", 0.6)
        self.assertEqual(scaled["scaling_type"], "fractional")
        self.assertEqual(scaled["quantity_decimal"], 0.5)

    def test_measured_ingredients_remain_continuous(self):
        scaled = self.scalar.scale_ingredient("1.25 cups flour", 1.5)
        self.assertEqual(scaled["scaling_type"], "continuous")
        self.assertEqual(scaled["quantity_decimal"], 1.88)

    def test_legacy_ingredients_get_an_atomic_base_quantity(self):
        ingredient = self.scalar.normalize_ingredient({
            "name": "eggs",
            "quantity_decimal": 2,
            "quantity_fraction": "2",
            "unit": "",
        })
        self.assertEqual(ingredient["base_quantity_decimal"], 2.0)
        self.assertFalse(ingredient["manual_overridden"])


if __name__ == "__main__":
    unittest.main()
