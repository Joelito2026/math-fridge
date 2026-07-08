import requests
from recipe_scrapers import scrape_html

def extract_recipe_facts(target_url: str) -> dict:
    """
    Fetches a recipe URL and extracts only the non-copyrightable factual data
    (ingredients, instructions, and times), stripping away all creative narrative.
    """
    # 1. Fetch the raw HTML (using a standard User-Agent to prevent basic blocking)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    response = requests.get(target_url, headers=headers)
    response.raise_for_status() # Throws an error if the URL is dead or blocked
    
    # 2. Pass the HTML into the scraper engine
    scraper = scrape_html(html=response.content, org_url=target_url)
    
    # 3. Structure the clean, factual data payload
    return {
        "title": scraper.title(),
        "original_yield": scraper.yields(),
        "prep_time_minutes": scraper.prep_time(),
        "cook_time_minutes": scraper.cook_time(),
        "ingredients": scraper.ingredients(),  # Returns a list of strings
        "instructions": scraper.instructions_list(), # Returns a list of strings
        "source_url": target_url
    }

# Quick local test block
if __name__ == "__main__":
    # Feel free to swap this with any recipe URL you want to test
    test_url = "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"
    clean_data = extract_recipe_facts(test_url)
    
    print(f"Recipe: {clean_data['title']}")
    print(f"Yields: {clean_data['original_yield']}")
    print("---")
    print(f"First Ingredient: {clean_data['ingredients'][0]}")
    print(f"First Step: {clean_data['instructions'][0]}")