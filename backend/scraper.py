import requests
from recipe_scrapers import scrape_html

def safe_extract(func, default=None):
    """
    Safely attempts to extract data using the scraper function.
    If the field (like cook_time) is missing from the website, 
    it catches the error and returns the default value instead of crashing.
    """
    try:
        return func()
    except Exception:
        return default

def extract_recipe_facts(target_url: str) -> dict:
    """
    Fetches a recipe URL and extracts only the non-copyrightable factual data
    (ingredients, instructions, and times), stripping away all creative narrative.
    """
    # 1. Fetch the raw HTML 
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    response = requests.get(target_url, headers=headers)
    response.raise_for_status() 
    
    # 2. Pass the HTML into the scraper engine
    scraper = scrape_html(html=response.content, org_url=target_url)
    
    # 3. Structure the clean, factual data payload using the safety net
    return {
        "title": safe_extract(scraper.title, "Unknown Title"),
        "original_yield": safe_extract(scraper.yields, "1 serving"),
        "prep_time_minutes": safe_extract(scraper.prep_time, None),
        "cook_time_minutes": safe_extract(scraper.cook_time, None),
        "ingredients": safe_extract(scraper.ingredients, []),  
        "instructions": safe_extract(scraper.instructions_list, []), 
        "source_url": target_url
    }

# Quick local test block
if __name__ == "__main__":
    # Testing the problematic cold sandwich URL
    test_url = "https://www.allrecipes.com/recipe/84259/italian-subs-restaurant-style/"
    clean_data = extract_recipe_facts(test_url)
    
    print(f"Recipe: {clean_data['title']}")
    print(f"Yields: {clean_data['original_yield']}")
    print(f"Cook Time: {clean_data['cook_time_minutes']}")
    print("---")
    if clean_data['ingredients']:
        print(f"First Ingredient: {clean_data['ingredients'][0]}")
    if clean_data['instructions']:
        print(f"First Step: {clean_data['instructions'][0]}")