import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedTimerStatus = 'running' | 'paused' | 'finished';

export type CookingProgress = {
  version: 1;
  targetYield?: number;
  currentStep: number;
  checkedIngredients: number[];
  timer: null | {
    status: SavedTimerStatus;
    duration: number;
    remainingSeconds: number;
    endsAt: number | null;
    step: number;
    notificationId: string | null;
  };
};

const keyForRecipe = (recipeId: string) => `math-fridge.cooking-progress.v1.${recipeId}`;

export async function loadCookingProgress(recipeId: string): Promise<CookingProgress | null> {
  try {
    const stored = await AsyncStorage.getItem(keyForRecipe(recipeId));
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<CookingProgress>;
    if (value.version !== 1 || !Number.isFinite(value.currentStep) || !Array.isArray(value.checkedIngredients)) return null;
    return value as CookingProgress;
  } catch {
    return null;
  }
}

export async function saveCookingProgress(recipeId: string, progress: CookingProgress) {
  try {
    await AsyncStorage.setItem(keyForRecipe(recipeId), JSON.stringify(progress));
  } catch {
    // Cooking mode should remain usable even if device storage is unavailable.
  }
}

export async function clearCookingProgress(recipeId: string) {
  try {
    await AsyncStorage.removeItem(keyForRecipe(recipeId));
  } catch {
    // A failed cleanup should not prevent the user from leaving cooking mode.
  }
}
