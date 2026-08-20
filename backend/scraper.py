import requests
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

class RecipeImageParser(HTMLParser):
    """Collects common social preview image metadata without adding dependencies."""
    def __init__(self):
        super().__init__()
        self.candidates = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta":
            return
        values = {key.lower(): value for key, value in attrs if key and value}
        key = (values.get("property") or values.get("name") or "").lower()
        if key in {"og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"}:
            self.candidates.append(values.get("content", ""))

def normalize_image_url(value, base_url):
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, dict):
        value = value.get("url") or value.get("contentUrl")
    if not isinstance(value, str) or not value.strip():
        return None
    resolved = urljoin(base_url, value.strip())
    parsed = urlparse(resolved)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or len(resolved) > 2048:
        return None
    return resolved

def extract_recipe_image(html, base_url, scraper):
    parser = RecipeImageParser()
    try:
        parser.feed(html.decode("utf-8", errors="ignore") if isinstance(html, bytes) else html)
    except Exception:
        pass

    for candidate in parser.candidates:
        normalized = normalize_image_url(candidate, base_url)
        if normalized:
            return normalized

    return normalize_image_url(safe_extract(scraper.image, None), base_url)

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
    from recipe_scrapers import scrape_html

    # 1. Fetch the raw HTML 
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    response = requests.get(target_url, headers=headers, timeout=20)
    response.raise_for_status() 
    
    # 2. Pass the HTML into the scraper engine
    scraper = scrape_html(html=response.content, org_url=response.url)
    
    # 3. Structure the clean, factual data payload using the safety net
    return {
        "title": safe_extract(scraper.title, "Unknown Title"),
        "original_yield": safe_extract(scraper.yields, "1 serving"),
        "prep_time_minutes": safe_extract(scraper.prep_time, None),
        "cook_time_minutes": safe_extract(scraper.cook_time, None),
        "ingredients": safe_extract(scraper.ingredients, []),  
        "instructions": safe_extract(scraper.instructions_list, []), 
        "image_url": extract_recipe_image(response.content, response.url, scraper),
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
