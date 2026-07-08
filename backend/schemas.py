from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime

# --- Internal JSONB Structure ---
class IngredientItem(BaseModel):
    name: str
    quantity_decimal: float
    quantity_fraction: str
    unit: str

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

class RecipeResponse(RecipeCreate):
    id: UUID
    user_id: UUID
    saved_at: datetime

    class Config:
        from_attributes = True # Tells Pydantic to read SQLAlchemy ORM models directly