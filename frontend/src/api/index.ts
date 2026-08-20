// src/api/index.ts
import { RecipeResponse } from '../types';
import { supabase } from '../services/supabase'; // <-- 1. Import Supabase
import { normalizeRecipeIngredients } from '../scaling';
import { Platform } from 'react-native';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const developmentApiHost = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';

export const API_BASE_URL = configuredApiUrl ?? `http://${developmentApiHost}:8000/api`;

// --- NEW: Helper to automatically grab the token ---
export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("No active session");
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
};

export const fetchRecipes = async (): Promise<RecipeResponse[]> => {
  try {
    const headers = await getAuthHeaders(); // <-- 2. Get headers
    const response = await fetch(`${API_BASE_URL}/recipes`, { headers }); // <-- 3. Pass headers
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    return json.recipes; 
  } catch (error) {
    console.error("Failed to fetch recipes:", error);
    return []; 
  }
};

export const extractAndSaveRecipe = async (url: string, targetYield: number = 1.0) => {
    const sendRequest = async (headers: Record<string, string>) => fetch(`${API_BASE_URL}/extract`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url,
          target_yield: targetYield
        }),
      });

    try {
      let response = await sendRequest(await getAuthHeaders());

      if (response.status === 401) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session?.access_token) {
          throw new Error('Your session expired. Please sign in again.');
        }
        response = await sendRequest({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session.access_token}`,
        });
      }
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Could not extract this recipe (${response.status}).`);
      }
  
      const json = await response.json();
      return json;
    } catch (error) {
      throw error; 
    }
};

export const uploadRecipeImage = async (base64Data: string): Promise<{ image_url: string; object_path: string }> => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recipe-images`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64_data: base64Data }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Image upload failed (${response.status}).`);
  }
  return response.json();
};

export const updateRecipe = async (id: string, updatedData: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatedData),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Catch the precise FastAPI error text
        throw new Error(errorData.detail || `Server Error: ${response.status}`);
      }
  
      return await response.json();
    } catch (error: any) {
      // Pass the actual system error upward to the UI
      throw new Error(error.message || "Failed to update recipe.");
    }
  };

export const deleteRecipe = async (id: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server Error: ${response.status}`);
  }

  return response.json();
};
  
export const fetchRecipeById = async (id: string) => {
  try {
    // 1. Manually check for a session instead of using getAuthHeaders()
    const { data: { session } } = await supabase.auth.getSession();
    
    // 2. Set up base headers for everyone (including guests)
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json' 
    };
    
    // 3. ONLY add the Authorization token if they are actually logged in
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // 4. Make the request using our custom guest-friendly headers
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return normalizeRecipeIngredients(await response.json());
  } catch (error) {
    console.error("Failed to fetch single recipe:", error);
    return null;
  }
};

export const saveManualRecipe = async (recipeData: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/recipes/manual`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(recipeData),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Could not save recipe (${response.status}).`);
      }
  
      return await response.json();
    } catch (error) {
      console.error("Failed to save manual recipe:", error);
      throw error;
    }
};

export const fetchPublicRecipes = async (dietaryTags: string[] = []) => {
  try {
    const query = dietaryTags.map((tag) => `dietary=${encodeURIComponent(tag)}`).join('&');
    const response = await fetch(`${API_BASE_URL}/recipes/public${query ? `?${query}` : ''}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.recipes;
  } catch (error) {
    console.error("Error fetching public recipes:", error);
    throw error;
  }
};

export const togglePublishStatus = async (recipeId: string, isPublic: boolean, dietaryTags?: string[], categoryTags?: string[]) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/publish`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ is_public: isPublic, dietary_tags: dietaryTags, category_tags: categoryTags }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error toggling publish status:", error);
    throw error;
  }
};

export const fetchRecipeTagSuggestions = async (recipeId: string): Promise<{ category: string; category_tags: string[]; dietary_tags: string[] }> => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/tag-suggestions`, { method: 'POST', headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Could not analyze recipe tags (${response.status}).`);
  }
  return response.json();
};

export const bookmarkRecipe = async (recipeId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error("You must be logged in to bookmark.");
    }

    const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/bookmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to bookmark recipe:", error);
    throw error;
  }
};

export const fetchBookmarkedRecipes = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];

    const response = await fetch(`${API_BASE_URL}/recipes/bookmarks`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return data.recipes;
  } catch (error) {
    console.error("Failed to fetch bookmarks:", error);
    return [];
  }
};

export const updateAccountProfile = async (displayName: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/account/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ display_name: displayName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server Error: ${response.status}`);
  }

  return response.json();
};

export const deleteAccount = async () => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/account`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server Error: ${response.status}`);
  }

  return response.json();
};
