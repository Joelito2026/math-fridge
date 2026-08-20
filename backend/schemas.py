from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Literal
from uuid import UUID
from datetime import datetime

# --- Internal JSONB Structure ---
class IngredientItem(BaseModel):
    name: str
    quantity_decimal: float
    base_quantity_decimal: float | None = None
    quantity_fraction: str
    unit: str
    scaling_type: Literal["continuous", "discrete", "fractional"] = "continuous"
    manual_overridden: bool = False
    override_quantity_decimal: float | None = None
    override_target_yield: float | None = None

class RecipeDataPayload(BaseModel):
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    ingredients: List[IngredientItem]
    instructions: List[str]

# --- API Request/Response Models ---
class RecipeCreate(BaseModel):
    source_url: HttpUrl
    title: str
    target_yield: str
    recipe_data: RecipeDataPayload
    image_url: str | None = None

class RecipeResponse(RecipeCreate):
    id: UUID
    user_id: UUID
    saved_at: datetime
    image_source: str | None = None
    image_source_url: str | None = None
    image_attribution: str | None = None
    image_usage_confirmed: bool = False

    class Config:
        from_attributes = True # Tells Pydantic to read SQLAlchemy ORM models directly
