from mangum import Mangum
import os
import json
import base64
import binascii
import uuid
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv
import ssl

# Bypass local SSL certificate errors
ssl._create_default_https_context = ssl._create_unverified_context

# --- SAFE INITIALIZATION ---
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") # <-- 1. Load the new key
supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not api_key or not supabase_url or not supabase_anon_key:
    raise ValueError("CRITICAL ERROR: Missing GEMINI_API_KEY, SUPABASE_URL, or SUPABASE_ANON_KEY in .env file!")

# --- NEW: INITIALIZE THE PUBLIC KEY FETCHER WITH AUTH HEADERS ---
jwks_url = f"{supabase_url}/auth/v1/jwks"
jwks_client = PyJWKClient(
    jwks_url,
    headers={"apikey": supabase_anon_key} # <-- 2. Hand the bouncer the guest pass!
)

from google import genai
from google.genai import types
gemini_client = genai.Client(api_key=api_key)

# --- STANDARD IMPORTS ---
from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder # <-- ADD THIS!
from sqlalchemy import create_engine, text, not_ # <-- Add not_ here
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError
from pydantic import BaseModel, HttpUrl
from typing import List, Optional

from models import Base, User, SavedRecipe
from scraper import extract_recipe_facts
from scalar import FractionScalar

# --- PHASE 3: THE AI HELPER FUNCTION ---
DIETARY_TAGS = (
    "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Egg-Free",
    "Nut-Free", "Pescatarian", "Keto", "Paleo", "Low-Carb",
)
CATEGORY_GROUPS = {
    "Cuisine": (
        "Afghan", "Algerian", "American", "Argentinian", "Armenian", "Australian", "Austrian", "Bangladeshi",
        "Belgian", "Brazilian", "British", "Burmese", "Cajun & Creole", "Cambodian", "Canadian", "Caribbean",
        "Central American", "Chilean", "Chinese", "Colombian", "Croatian", "Cuban", "Czech", "Danish",
        "Dominican", "Dutch", "Egyptian", "Eritrean", "Ethiopian", "Fijian", "Filipino", "Finnish", "French",
        "Georgian", "German", "Ghanaian", "Greek", "Haitian", "Hawaiian", "Hungarian", "Icelandic", "Indian",
        "Indonesian", "Iraqi", "Irish", "Israeli", "Italian", "Jamaican", "Japanese", "Jordanian", "Kenyan",
        "Korean", "Laotian", "Latin American", "Lebanese", "Malaysian", "Māori", "Mediterranean", "Mexican",
        "Middle Eastern", "Mongolian", "Moroccan", "Nepalese", "New Zealand", "Nigerian", "Norwegian",
        "Pakistani", "Palestinian", "Persian", "Peruvian", "Polish", "Polynesian", "Portuguese", "Puerto Rican",
        "Québécois", "Romanian", "Russian", "Samoan", "Senegalese", "Serbian", "Singaporean", "Somali",
        "South African", "Southern", "Spanish", "Sri Lankan", "Swedish", "Swiss", "Syrian", "Taiwanese",
        "Tex-Mex", "Thai", "Tibetan", "Trinidadian & Tobagonian", "Tunisian", "Turkish", "Ukrainian",
        "Uzbek", "Venezuelan", "Vietnamese", "West African", "Jewish", "Fusion",
    ),
    "Meal Type": ("Afternoon Tea", "Appetizer", "Breakfast", "Brunch", "Dessert", "Dinner", "Drinks", "Late-Night", "Lunch", "Picnic", "Potluck", "Snack", "Supper"),
    "Seasonal": ("Fresh Spring Recipes", "Spring Celebrations", "Summer Grilling", "Summer Favorites", "Picnic Season", "Back-to-School", "Cozy Fall Soups", "Fall Comfort Food", "Apple Season", "Pumpkin Season", "Hearty Winter Meals", "Holiday Baking", "Holiday Entertaining", "Game Day Favorites", "Slow Cooker Season", "Light & Fresh Meals"),
    "Dish Category": ("Appetizers", "Baking", "Bread", "Breakfast Dishes", "Burgers", "Casseroles", "Condiments", "Dessert", "Drinks", "Main Dishes", "One-Pot Meals", "Pasta", "Pizza", "Salad", "Sandwiches", "Sauces", "Side Dishes", "Snacks", "Soup", "Stews", "Tacos & Wraps"),
    "Ingredient": ("Beef", "Chocolate", "Dairy", "Eggs", "Fruits", "Grains & Rice", "Herbs & Spices", "Lamb", "Legumes", "Mushrooms", "Nuts & Seeds", "Pasta & Noodles", "Pork", "Poultry", "Seafood", "Tofu & Tempeh", "Vegetables"),
}
CATEGORY_TAGS = ("Popular",) + tuple(tag for tags in CATEGORY_GROUPS.values() for tag in tags)

def normalize_dietary_tags(tags) -> list[str]:
    if not isinstance(tags, list):
        return []
    lookup = {tag.lower(): tag for tag in DIETARY_TAGS}
    return list(dict.fromkeys(lookup[tag.strip().lower()] for tag in tags if isinstance(tag, str) and tag.strip().lower() in lookup))

def normalize_category_tags(tags) -> list[str]:
    if not isinstance(tags, list):
        return []
    lookup = {tag.lower(): tag for tag in CATEGORY_TAGS}
    return list(dict.fromkeys(lookup[tag.strip().lower()] for tag in tags if isinstance(tag, str) and tag.strip().lower() in lookup))

def get_recipe_metadata_with_ai(title: str, ingredients: list) -> dict:
    prompt = f"""
    You are a culinary recipe classifier. Suggest every clearly applicable discovery category from these exact groups:
    {json.dumps(CATEGORY_GROUPS)}
    A recipe may have multiple tags across groups. For example, tortillas may be both Bread and Mexican.
    Pick one primary_category from the suggested category_tags for compact recipe cards.
    Only use Seasonal tags when the title, ingredients, or cooking method clearly support them.
    Also identify every dietary tag clearly supported by the ingredients from this exact list:
    {', '.join(DIETARY_TAGS)}.
    Be conservative. Do not apply a tag when an ingredient is ambiguous or commonly conflicts with it.
    Vegetarian excludes meat, poultry, and seafood. Vegan also excludes eggs, dairy, and honey.
    Gluten-Free excludes wheat, barley, rye, regular flour, bread, and non-certified oats.
    Dairy-Free excludes milk, butter, cheese, cream, whey, and casein. Egg-Free excludes eggs and egg products.
    Nut-Free excludes both peanuts and tree nuts. Pescatarian may include seafood but excludes meat and poultry.
    Keto and Low-Carb require the ingredient quantities to plausibly support the claim; if uncertain, omit them.
    Never infer Halal or Kosher because ingredients cannot establish sourcing, certification, or preparation.
    Recipe Title: {title}
    Ingredients: {', '.join(ingredients[:15])}
    Return ONLY valid JSON matching: {{"primary_category": "CategoryName", "category_tags": ["Tag"], "dietary_tags": ["Tag"]}}
    """
    try:
        response = gemini_client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        result = json.loads(response.text)
        category_tags = normalize_category_tags(result.get("category_tags"))
        primary_category = result.get("primary_category")
        if primary_category not in category_tags:
            primary_category = category_tags[0] if category_tags else "Popular"
        if primary_category not in category_tags:
            category_tags.insert(0, primary_category)
        return {
            "category": primary_category,
            "category_tags": category_tags,
            "dietary_tags": normalize_dietary_tags(result.get("dietary_tags")),
        }
    except Exception as e:
        print(f"AI Categorization Failed: {e}")
        return {"category": "Popular", "category_tags": ["Popular"], "dietary_tags": []}

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://math_admin:local_dev_password@localhost:5432/math_fridge",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(80)"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS image_url VARCHAR(2048)"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS image_source VARCHAR(20)"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS image_source_url VARCHAR(2048)"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS image_attribution VARCHAR(255)"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS image_usage_confirmed BOOLEAN NOT NULL DEFAULT FALSE"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS dietary_tags JSONB NOT NULL DEFAULT '[]'::jsonb"))
    connection.execute(text("ALTER TABLE saved_recipes ADD COLUMN IF NOT EXISTS category_tags JSONB NOT NULL DEFAULT '[]'::jsonb"))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"], 
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

fraction_scalar = FractionScalar()

# --- NEW: SUPABASE JWKS SECURITY ---
security = HTTPBearer()

import urllib.request
import urllib.error
import urllib.parse

# auto_error=False means it won't instantly crash if a guest visits without a token
optional_security = HTTPBearer(auto_error=False)

def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(optional_security), db: Session = Depends(get_db)) -> Optional[User]:
    """Tries to authenticate, but returns None if the user is a guest."""
    if not credentials:
        return None
    try:
        req = urllib.request.Request(
            f"{supabase_url}/auth/v1/user", 
            headers={"Authorization": f"Bearer {credentials.credentials}", "apikey": supabase_anon_key}
        )
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            user_data = json.loads(response.read())
            
        return db.query(User).filter(User.id == user_data.get("id")).first()
    except:
        return None # If token is expired or fake, just treat them as a guest
    
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    """Verifies the token by asking Supabase directly, bypassing local cryptography."""
    token = credentials.credentials
    try:
        # 1. Ask Supabase's official server to verify the token for us
        req = urllib.request.Request(
            f"{supabase_url}/auth/v1/user", 
            headers={
                "Authorization": f"Bearer {token}", 
                "apikey": supabase_anon_key
            }
        )
        
        # 2. Execute the request (re-using the unverified SSL context so local Mac Python doesn't block it)
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as response:
            user_data = json.loads(response.read())
        
        # 3. If Supabase responded with a 200 OK, the token is perfectly valid! 
        user_id = user_data.get("id")
        email = user_data.get("email")
        user_metadata = user_data.get("user_metadata") or {}
        display_name = user_metadata.get("full_name") or user_metadata.get("display_name")
        
        # 4. Sync the verified user to the local PostgreSQL database
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(id=user_id, email=email, display_name=display_name)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            changed = False
            if not user.email:
                user.email = email
                changed = True
            if display_name and user.display_name != display_name:
                user.display_name = display_name
                changed = True
            if changed:
                db.commit()
            
        return user

    except urllib.error.HTTPError as e:
        print(f"❌ Supabase Rejected Token: {e.code} - {e.read().decode('utf-8')}")
        raise HTTPException(status_code=401, detail="Authentication failed: Invalid or expired token.")
    except Exception as e:
        print(f"❌ Server Error: {e}") 
        raise HTTPException(status_code=500, detail="Internal server verification error.")

# --- ROUTES ---
@app.get("/")
def read_root():
    return {"message": "Math Fridge Backend is online and secured."}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except OperationalError:
        raise HTTPException(status_code=503, detail="Database connection failed.")

class ProfileUpdate(BaseModel):
    display_name: str

@app.put("/api/account/profile")
def update_account_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    display_name = " ".join(payload.display_name.split()).strip()
    if len(display_name) < 2 or len(display_name) > 40:
        raise HTTPException(status_code=422, detail="Display name must be between 2 and 40 characters.")

    current_user.display_name = display_name
    db.commit()
    return {"status": "success", "display_name": display_name}

@app.delete("/api/account")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Account deletion is not configured on the server.",
        )

    # Keep the local deletion transactional until Supabase confirms Auth deletion.
    db.delete(current_user)
    db.flush()

    request = urllib.request.Request(
        f"{supabase_url}/auth/v1/admin/users/{current_user.id}",
        method="DELETE",
        headers={
            "Authorization": f"Bearer {supabase_service_role_key}",
            "apikey": supabase_service_role_key,
        },
    )

    try:
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(request, context=context):
            pass
        db.commit()
        return {"status": "success", "message": "Account and recipe data deleted."}
    except urllib.error.HTTPError as error:
        db.rollback()
        print(f"Supabase account deletion failed: {error.code}")
        raise HTTPException(status_code=502, detail="Could not delete the authentication account.")
    except Exception as error:
        db.rollback()
        print(f"Account deletion failed: {error}")
        raise HTTPException(status_code=502, detail="Could not complete account deletion.")

@app.get("/api/recipes/public")
def get_public_recipes(dietary: List[str] = Query(default=[]), db: Session = Depends(get_db)):
    allowed_tags = {tag.lower() for tag in DIETARY_TAGS}
    invalid_tags = [tag for tag in dietary if tag.strip().lower() not in allowed_tags]
    if invalid_tags:
        raise HTTPException(status_code=422, detail=f"Unsupported dietary filter: {invalid_tags[0]}")
    selected_tags = normalize_dietary_tags(dietary)
    query = db.query(SavedRecipe).filter(SavedRecipe.is_public == True)
    for tag in selected_tags:
        query = query.filter(SavedRecipe.dietary_tags.contains([tag]))
    recipes = query.all()
    
    # 1. Safely convert the database objects to normal dictionaries
    safe_recipes = jsonable_encoder(recipes)
    
    # 2. Attach the author's name to each one
    for recipe in safe_recipes:
        user = db.query(User).filter(User.id == recipe["user_id"]).first()
        if user and (user.display_name or user.email):
            recipe["author_name"] = user.display_name or user.email.split("@")[0].capitalize()
        else:
            recipe["author_name"] = "Unknown Chef"
            
    return {"status": "success", "count": len(safe_recipes), "recipes": safe_recipes}


# 🔒 SECURED ROUTES: Require a valid Supabase token via Depends(get_current_user)

class ExtractRequest(BaseModel):
    url: HttpUrl
    target_yield: float = 1.0  

class RecipeImageUpload(BaseModel):
    base64_data: str

def storage_request(path: str, method: str = "GET", body: bytes | None = None, content_type: str = "application/json", extra_headers: Optional[dict] = None):
    if not supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Recipe image storage is not configured on the server.")
    headers = {
        "Authorization": f"Bearer {supabase_service_role_key}",
        "apikey": supabase_service_role_key,
        "Content-Type": content_type,
    }
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(
        f"{supabase_url}/storage/v1/{path}",
        data=body,
        method=method,
        headers=headers,
    )
    context = ssl._create_unverified_context()
    return urllib.request.urlopen(request, context=context)

def delete_storage_object(object_path: str):
    try:
        body = json.dumps({"prefixes": [object_path]}).encode("utf-8")
        with storage_request("object/recipe-images", method="DELETE", body=body):
            pass
    except Exception as error:
        print(f"Recipe image cleanup failed for {object_path}: {error}")

def ensure_recipe_image_bucket():
    try:
        with storage_request("bucket/recipe-images"):
            return
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        try:
            storage_error_code = json.loads(detail).get("code")
        except (json.JSONDecodeError, AttributeError):
            storage_error_code = None
        if error.code != 404 and storage_error_code != "NoSuchBucket":
            raise HTTPException(status_code=502, detail=f"Could not check recipe image storage: {detail or error.reason}")

    body = json.dumps({
        "id": "recipe-images",
        "name": "recipe-images",
        "public": False,
        "file_size_limit": 3 * 1024 * 1024,
        "allowed_mime_types": ["image/jpeg"],
    }).encode("utf-8")
    try:
        with storage_request("bucket", method="POST", body=body):
            pass
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        normalized_detail = detail.lower()
        if error.code in {400, 409} and ("already exists" in normalized_detail or "duplicate" in normalized_detail):
            return
        raise HTTPException(status_code=502, detail=f"Could not create recipe image storage: {detail or error.reason}")

@app.post("/api/recipe-images")
def upload_recipe_image(payload: RecipeImageUpload, request: Request, current_user: User = Depends(get_current_user)):
    try:
        image_bytes = base64.b64decode(payload.base64_data, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(status_code=422, detail="The selected image could not be decoded.")
    if not image_bytes.startswith(b"\xff\xd8\xff"):
        raise HTTPException(status_code=422, detail="Compressed recipe images must be JPEG files.")
    if len(image_bytes) > 3 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The compressed image is larger than 3 MB.")

    object_path = f"{current_user.id}/{uuid.uuid4()}.jpg"
    encoded_path = urllib.parse.quote(object_path, safe="/")
    ensure_recipe_image_bucket()
    try:
        with storage_request(
            f"object/recipe-images/{encoded_path}",
            method="POST",
            body=image_bytes,
            content_type="image/jpeg",
            extra_headers={"x-upsert": "false"},
        ):
            pass
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Image upload failed: {detail or error.reason}")

    proxy_url = str(request.base_url).rstrip("/") + f"/api/recipe-images/{object_path}"
    return {"image_url": proxy_url, "object_path": object_path}

@app.get("/api/recipe-images/{object_path:path}")
def get_recipe_image(object_path: str, current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    recipes = db.query(SavedRecipe).filter(SavedRecipe.image_source_url == object_path).all()
    can_view = any(recipe.is_public or (current_user and recipe.user_id == current_user.id) for recipe in recipes)
    if not can_view:
        raise HTTPException(status_code=404, detail="Recipe image not found.")
    encoded_path = urllib.parse.quote(object_path, safe="/")
    try:
        with storage_request(f"object/recipe-images/{encoded_path}") as stored_image:
            return Response(content=stored_image.read(), media_type=stored_image.headers.get_content_type(), headers={"Cache-Control": "private, max-age=3600"})
    except urllib.error.HTTPError:
        raise HTTPException(status_code=404, detail="Recipe image not found.")

@app.post("/api/extract")
def extract_recipe(request: ExtractRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        raw_data = extract_recipe_facts(str(request.url))
        ai_metadata = get_recipe_metadata_with_ai(raw_data["title"], raw_data["ingredients"])
        
        processed_ingredients = []
        for raw_ingredient in raw_data["ingredients"]:
            scaled_item = fraction_scalar.scale_ingredient(
                ingredient_string=raw_ingredient,
                scale_factor=request.target_yield
            )
            processed_ingredients.append(scaled_item)
            
        new_recipe = SavedRecipe(
            user_id=current_user.id, # Uses the real authenticated ID!
            source_url=str(request.url),
            title=raw_data["title"],
            target_yield=str(request.target_yield),
            is_public=False,
            category=ai_metadata["category"],
            category_tags=ai_metadata["category_tags"],
            dietary_tags=ai_metadata["dietary_tags"],
            image_url=None,
            image_source="extracted" if raw_data.get("image_url") else None,
            image_source_url=raw_data.get("image_url"),
            image_usage_confirmed=False,
            recipe_data={
                "prep_time_minutes": raw_data.get("prep_time_minutes"),
                "cook_time_minutes": raw_data.get("cook_time_minutes"),
                "ingredients": processed_ingredients,
                "instructions": raw_data.get("instructions")
            }
        )
        
        db.add(new_recipe)
        db.commit()
        db.refresh(new_recipe) 
        
        return {
            "status": "success",
            "message": "Recipe saved to database.",
            "recipe_id": new_recipe.id,
            "data": raw_data
        }
    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/recipes/{recipe_id}/bookmark")
def bookmark_recipe(recipe_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Find the original community recipe
    original = db.query(SavedRecipe).filter(SavedRecipe.id == recipe_id).first()
    
    if not original or not original.is_public:
        raise HTTPException(status_code=404, detail="Public recipe not found.")
        
    if original.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot bookmark your own recipe.")
        
    # --- NEW: Look up the original chef's name ---
    original_user = db.query(User).filter(User.id == original.user_id).first()
    if original_user and (original_user.display_name or original_user.email):
        orig_author = original_user.display_name or original_user.email.split("@")[0].capitalize()
    else:
        orig_author = "Unknown Chef"
    
    # Inject their name into the recipe data so it's preserved forever!
    new_recipe_data = original.recipe_data.copy()
    new_recipe_data["original_author"] = orig_author
    # ---------------------------------------------

    # 2. Clone it
    cloned_recipe = SavedRecipe(
        user_id=current_user.id,
        title=original.title,
        source_url=f"bookmark_{original.id}", 
        target_yield=original.target_yield,
        is_public=False,
        category=original.category,
        category_tags=original.category_tags or [],
        dietary_tags=original.dietary_tags or [],
        image_url=original.image_url,
        image_source=original.image_source,
        image_source_url=original.image_source_url,
        image_attribution=original.image_attribution,
        image_usage_confirmed=original.image_usage_confirmed,
        recipe_data=new_recipe_data # <-- Saved with the original author's name!
    )
    
    db.add(cloned_recipe)
    db.commit()
    db.refresh(cloned_recipe)
    
    return {"status": "success", "message": "Recipe bookmarked!", "id": cloned_recipe.id}


# ---------------------------------------------------------
# 1. MY VAULT ROUTE (Crash-proof version)
# ---------------------------------------------------------
@app.get("/api/recipes")
def get_all_recipes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Grabs everything
    recipes = db.query(SavedRecipe).filter(SavedRecipe.user_id == current_user.id).all()
    
    # --- NEW: Safely sift out the bookmarks ---
    vault_recipes = []
    for r in recipes:
        if r.source_url and r.source_url.startswith("bookmark_"):
            continue # Skip it!
        vault_recipes.append(r)
    # ------------------------------------------

    # 1. Safely convert the FILTERED list to normal dictionaries
    safe_recipes = jsonable_encoder(vault_recipes)
    
    # 2. Grab your name (or default to "Me")
    author = current_user.display_name or (current_user.email.split("@")[0].capitalize() if current_user.email else "Me")
    
    # 3. Stamp your name on all your private recipes
    for recipe in safe_recipes:
        recipe["author_name"] = author
        
    return {"status": "success", "count": len(safe_recipes), "recipes": safe_recipes}


# ---------------------------------------------------------
# 2. BOOKMARKS ROUTE (Crash-proof version)
# ---------------------------------------------------------
@app.get("/api/recipes/bookmarks")
def get_bookmarked_recipes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Grabs everything
    recipes = db.query(SavedRecipe).filter(SavedRecipe.user_id == current_user.id).all()
    
    # --- NEW: Keep ONLY the bookmarks ---
    bookmarks = []
    for r in recipes:
        if r.source_url and r.source_url.startswith("bookmark_"):
            bookmarks.append(r)
    # ------------------------------------
            
    safe_recipes = jsonable_encoder(bookmarks)
    
    for recipe in safe_recipes:
        # Pulls the original chef's name we saved earlier
        recipe["author_name"] = recipe.get("recipe_data", {}).get("original_author", "Unknown Chef")
        
    return {"status": "success", "count": len(safe_recipes), "recipes": safe_recipes}

# ---------------------------------------------------------
# 3. INDIVIDUAL RECIPE ROUTE (Catches everything else)
# ---------------------------------------------------------
@app.get("/api/recipes/{recipe_id}")
def get_recipe_by_id(recipe_id: str, current_user: Optional[User] = Depends(get_optional_user), db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).filter(SavedRecipe.id == recipe_id).first()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    if not recipe.is_public:
        if not current_user or recipe.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="This recipe is private.")
            
    return recipe

class ManualIngredient(BaseModel):
    quantity: str
    unit: str
    name: str

class ManualRecipeCreate(BaseModel):
    title: str
    prep_time_minutes: int
    cook_time_minutes: int
    ingredients: List[ManualIngredient]
    instructions: List[str]
    image_url: Optional[HttpUrl] = None
    image_attribution: Optional[str] = None
    image_usage_confirmed: bool = False
    image_source: Optional[str] = None
    image_source_url: Optional[str] = None

@app.post("/api/recipes/manual")
def create_manual_recipe(recipe_in: ManualRecipeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if recipe_in.image_url and not recipe_in.image_usage_confirmed:
        raise HTTPException(status_code=422, detail="Confirm that you own or have permission to use this image.")
    ingredient_descriptions = [f"{item.quantity} {item.unit} {item.name}".strip() for item in recipe_in.ingredients]
    ai_metadata = get_recipe_metadata_with_ai(recipe_in.title, ingredient_descriptions)
    recipe_data = {
        "prep_time_minutes": recipe_in.prep_time_minutes,
        "cook_time_minutes": recipe_in.cook_time_minutes,
        "ingredients": [
            {
                "quantity_decimal": 0.0, 
                "base_quantity_decimal": fraction_scalar.parse_quantity(ing.quantity),
                "quantity_fraction": ing.quantity,
                "unit": ing.unit,
                "name": ing.name,
                "scaling_type": fraction_scalar.classify_ingredient(ing.unit, ing.name),
                "manual_overridden": False,
            } for ing in recipe_in.ingredients
        ],
        "instructions": recipe_in.instructions
    }
    
    new_recipe = SavedRecipe(
        user_id=current_user.id,
        title=recipe_in.title,
        source_url="Manual Entry",
        target_yield=1.0,
        is_public=False,
        category=ai_metadata["category"],
        category_tags=ai_metadata["category_tags"],
        dietary_tags=ai_metadata["dietary_tags"],
        image_url=str(recipe_in.image_url) if recipe_in.image_url else None,
        image_source=(recipe_in.image_source if recipe_in.image_source in {"upload", "user_url"} else "user_url") if recipe_in.image_url else None,
        image_source_url=(recipe_in.image_source_url or str(recipe_in.image_url)) if recipe_in.image_url else None,
        image_attribution=recipe_in.image_attribution.strip()[:255] if recipe_in.image_attribution else None,
        image_usage_confirmed=recipe_in.image_usage_confirmed,
        recipe_data=recipe_data
    )
    
    db.add(new_recipe)
    db.commit()
    db.refresh(new_recipe)
    return new_recipe

class RecipeUpdate(BaseModel):
    title: str
    ingredients: list
    instructions: list
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    image_url: Optional[str] = None
    image_source: Optional[str] = None
    image_source_url: Optional[str] = None
    image_attribution: Optional[str] = None
    image_usage_confirmed: Optional[bool] = None
    dietary_tags: Optional[List[str]] = None
    category_tags: Optional[List[str]] = None

@app.post("/api/recipes/{recipe_id}/tag-suggestions")
def suggest_recipe_tags(recipe_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).filter(SavedRecipe.id == recipe_id, SavedRecipe.user_id == current_user.id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    ingredients = recipe.recipe_data.get("ingredients", []) if recipe.recipe_data else []
    ingredient_descriptions = [
        f"{ingredient.get('quantity_fraction', '')} {ingredient.get('unit', '')} {ingredient.get('name', '')}".strip()
        if isinstance(ingredient, dict) else str(ingredient)
        for ingredient in ingredients
    ]
    return get_recipe_metadata_with_ai(recipe.title, ingredient_descriptions)

@app.put("/api/recipes/{recipe_id}")
def update_recipe(recipe_id: str, recipe_in: RecipeUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).filter(
        SavedRecipe.id == recipe_id, 
        SavedRecipe.user_id == current_user.id
    ).first()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    previous_upload_path = recipe.image_source_url if recipe.image_source == "upload" else None
    recipe.title = recipe_in.title
    updated_data = recipe.recipe_data.copy()
    
    formatted_ingredients = []
    for ingredient in recipe_in.ingredients:
        if isinstance(ingredient, str):
            ingredient = {"quantity_fraction": "", "quantity_decimal": 0.0, "unit": "", "name": ingredient}
        formatted_ingredients.append(fraction_scalar.normalize_ingredient(ingredient))
    
    updated_data["ingredients"] = formatted_ingredients
    updated_data["instructions"] = recipe_in.instructions
    ingredient_descriptions = [
        f"{ingredient.get('quantity_fraction', '')} {ingredient.get('unit', '')} {ingredient.get('name', '')}".strip()
        for ingredient in formatted_ingredients
    ]
    ai_metadata = None
    if "dietary_tags" in recipe_in.model_fields_set:
        recipe.dietary_tags = normalize_dietary_tags(recipe_in.dietary_tags)
    else:
        ai_metadata = get_recipe_metadata_with_ai(recipe_in.title, ingredient_descriptions)
        recipe.category = ai_metadata["category"]
        recipe.dietary_tags = ai_metadata["dietary_tags"]
    if "category_tags" in recipe_in.model_fields_set:
        recipe.category_tags = normalize_category_tags(recipe_in.category_tags)
        recipe.category = recipe.category if recipe.category in recipe.category_tags else (recipe.category_tags[0] if recipe.category_tags else "Popular")
    else:
        ai_metadata = ai_metadata or get_recipe_metadata_with_ai(recipe_in.title, ingredient_descriptions)
        recipe.category = ai_metadata["category"]
        recipe.category_tags = ai_metadata["category_tags"]
    if recipe_in.prep_time_minutes is not None:
        updated_data["prep_time_minutes"] = recipe_in.prep_time_minutes
    if recipe_in.cook_time_minutes is not None:
        updated_data["cook_time_minutes"] = recipe_in.cook_time_minutes
    update_fields = recipe_in.model_fields_set
    if "image_url" in update_fields:
        recipe.image_url = recipe_in.image_url
    if "image_source" in update_fields:
        recipe.image_source = recipe_in.image_source
    if "image_source_url" in update_fields:
        recipe.image_source_url = recipe_in.image_source_url
    if "image_attribution" in update_fields:
        recipe.image_attribution = recipe_in.image_attribution
    if "image_usage_confirmed" in update_fields:
        recipe.image_usage_confirmed = bool(recipe_in.image_usage_confirmed)
    if recipe.image_url and recipe.image_source in {"upload", "user_url"} and not recipe.image_usage_confirmed:
        raise HTTPException(status_code=422, detail="Confirm that you own or have permission to use this image.")
    
    recipe.recipe_data = updated_data
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(recipe, "recipe_data")
    
    db.commit()
    if previous_upload_path and previous_upload_path != recipe.image_source_url:
        remaining_references = db.query(SavedRecipe).filter(SavedRecipe.image_source_url == previous_upload_path).count()
        if remaining_references == 0:
            delete_storage_object(previous_upload_path)
    return {"status": "success", "message": "Recipe updated successfully."}

@app.delete("/api/recipes/{recipe_id}")
def delete_recipe(recipe_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).filter(
        SavedRecipe.id == recipe_id,
        SavedRecipe.user_id == current_user.id
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    upload_path = recipe.image_source_url if recipe.image_source == "upload" else None
    db.delete(recipe)
    db.commit()
    if upload_path and db.query(SavedRecipe).filter(SavedRecipe.image_source_url == upload_path).count() == 0:
        delete_storage_object(upload_path)
    return {"status": "success", "message": "Recipe deleted successfully."}

class PublishToggle(BaseModel):
    is_public: bool
    dietary_tags: Optional[List[str]] = None
    category_tags: Optional[List[str]] = None

@app.put("/api/recipes/{recipe_id}/publish")
def toggle_publish_status(recipe_id: str, payload: PublishToggle, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    recipe = db.query(SavedRecipe).filter(
        SavedRecipe.id == recipe_id, 
        SavedRecipe.user_id == current_user.id
    ).first()
    
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found or unauthorized.")
    if payload.is_public and recipe.image_url and not recipe.image_usage_confirmed:
        raise HTTPException(status_code=422, detail="Confirm that you have permission to publish this image, or remove it first.")
    if payload.is_public and payload.dietary_tags is not None:
        recipe.dietary_tags = normalize_dietary_tags(payload.dietary_tags)
    elif payload.is_public and not recipe.dietary_tags:
        ingredients = recipe.recipe_data.get("ingredients", []) if recipe.recipe_data else []
        ingredient_descriptions = [
            f"{ingredient.get('quantity_fraction', '')} {ingredient.get('unit', '')} {ingredient.get('name', '')}".strip()
            if isinstance(ingredient, dict) else str(ingredient)
            for ingredient in ingredients
        ]
        ai_metadata = get_recipe_metadata_with_ai(recipe.title, ingredient_descriptions)
        recipe.category = ai_metadata["category"]
        recipe.category_tags = ai_metadata["category_tags"]
        recipe.dietary_tags = ai_metadata["dietary_tags"]
    if payload.is_public and payload.category_tags is not None:
        recipe.category_tags = normalize_category_tags(payload.category_tags)
        recipe.category = recipe.category if recipe.category in recipe.category_tags else (recipe.category_tags[0] if recipe.category_tags else "Popular")
        
    recipe.is_public = payload.is_public
    db.commit()
    
    status_text = "public" if payload.is_public else "private"
    return {"status": "success", "message": f"Recipe is now {status_text}."}

handler = Mangum(app)