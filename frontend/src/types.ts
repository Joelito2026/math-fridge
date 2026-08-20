// src/types.ts

export interface IngredientItem {
    name: string;
    quantity_decimal: number;
    base_quantity_decimal?: number;
    quantity_fraction: string;
    unit: string;
    scaling_type?: 'continuous' | 'discrete' | 'fractional';
    manual_overridden?: boolean;
    override_quantity_decimal?: number;
    override_target_yield?: number;
  }
  
  export interface RecipeData {
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    ingredients: IngredientItem[];
    instructions: string[];
  }
  
  // This mirrors the exact JSON response your GET /api/recipes route returns
  export interface RecipeResponse {
    id: string;
    user_id: string;
    source_url: string;
    title: string;
    target_yield: string;
    recipe_data: RecipeData;
    saved_at: string;
    is_public: boolean; // <-- Add this new line!
    category: string;
    category_tags?: string[];
    dietary_tags?: string[];
    image_url?: string | null;
    image_source?: 'extracted' | 'user_url' | 'upload' | null;
    image_source_url?: string | null;
    image_attribution?: string | null;
    image_usage_confirmed?: boolean;
    created_at: string;
    author_name?: string; // <-- Add this line
  }
