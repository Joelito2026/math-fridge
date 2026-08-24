"""Offline authorization checks for recipe visibility and ownership.

These tests deliberately replace the database engine during import. They exercise
the FastAPI route functions without needing a running Postgres instance, Supabase
project, or real access token.
"""

import importlib
import os
import sys
import unittest
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from models import Base


def load_main_for_test():
    """Import the route module without connecting to external services."""
    sys.modules.pop("main", None)
    fake_engine = MagicMock()
    fake_engine.begin.return_value.__enter__.return_value = MagicMock()
    fake_mangum = ModuleType("mangum")
    fake_mangum.Mangum = MagicMock()

    with (
        patch.dict(
            os.environ,
            {
                "GEMINI_API_KEY": "test-key",
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_ANON_KEY": "test-anon-key",
            },
            clear=False,
        ),
        patch("sqlalchemy.create_engine", return_value=fake_engine),
        patch("sqlalchemy.orm.sessionmaker", return_value=MagicMock()),
        patch.object(Base.metadata, "create_all"),
        patch.dict(sys.modules, {"mangum": fake_mangum}),
    ):
        return importlib.import_module("main")


main = load_main_for_test()


class RecipeQuery:
    def __init__(self, result):
        self.result = result
        self.filters = []

    def filter(self, *criteria):
        self.filters.append(criteria)
        return self

    def first(self):
        return self.result


class RecipeDb:
    def __init__(self, result):
        self.query_result = RecipeQuery(result)

    def query(self, _model):
        return self.query_result


def recipe(*, owner_id="owner-id", is_public=False):
    return SimpleNamespace(
        id="recipe-id",
        user_id=owner_id,
        is_public=is_public,
        title="Private Tortillas",
        source_url="manual",
        target_yield="1",
        category="Popular",
        category_tags=[],
        dietary_tags=[],
        image_url=None,
        image_source=None,
        image_source_url=None,
        image_attribution=None,
        image_usage_confirmed=False,
        recipe_data={"ingredients": [], "instructions": []},
    )


class RecipeAccessControlTests(unittest.TestCase):
    def test_anonymous_user_cannot_read_a_private_recipe(self):
        db = RecipeDb(recipe())

        with self.assertRaises(HTTPException) as raised:
            main.get_recipe_by_id("recipe-id", current_user=None, db=db)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(raised.exception.detail, "This recipe is private.")

    def test_different_user_cannot_read_a_private_recipe(self):
        db = RecipeDb(recipe(owner_id="owner-id"))
        other_user = SimpleNamespace(id="another-user")

        with self.assertRaises(HTTPException) as raised:
            main.get_recipe_by_id("recipe-id", current_user=other_user, db=db)

        self.assertEqual(raised.exception.status_code, 403)

    def test_owner_can_read_their_private_recipe(self):
        private_recipe = recipe(owner_id="owner-id")
        db = RecipeDb(private_recipe)
        owner = SimpleNamespace(id="owner-id")

        self.assertIs(main.get_recipe_by_id("recipe-id", current_user=owner, db=db), private_recipe)

    def test_public_recipe_can_be_read_without_a_session(self):
        public_recipe = recipe(is_public=True)
        db = RecipeDb(public_recipe)

        self.assertIs(main.get_recipe_by_id("recipe-id", current_user=None, db=db), public_recipe)

    def test_unknown_recipe_returns_not_found_without_disclosing_any_private_data(self):
        db = RecipeDb(None)

        with self.assertRaises(HTTPException) as raised:
            main.get_recipe_by_id("missing-recipe", current_user=None, db=db)

        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(raised.exception.detail, "Recipe not found")

    def test_edit_delete_and_publish_scope_the_lookup_to_the_authenticated_owner(self):
        user = SimpleNamespace(id="another-user")

        for route, payload in (
            (main.update_recipe, MagicMock()),
            (main.delete_recipe, None),
            (main.toggle_publish_status, MagicMock()),
        ):
            db = RecipeDb(None)
            with self.subTest(route=route.__name__), self.assertRaises(HTTPException) as raised:
                if payload is None:
                    route("owner-recipe", current_user=user, db=db)
                else:
                    route("owner-recipe", payload, current_user=user, db=db)

            self.assertEqual(raised.exception.status_code, 404)
            self.assertEqual(len(db.query_result.filters), 1)
            # Each protected mutation must include both recipe ID and owner ID.
            self.assertEqual(len(db.query_result.filters[0]), 2)


if __name__ == "__main__":
    unittest.main()
