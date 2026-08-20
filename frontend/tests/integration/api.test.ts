const mockGetSession = jest.fn();

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: jest.fn(),
    },
  },
}));

import {
  API_BASE_URL,
  bookmarkRecipe,
  deleteRecipe,
  fetchBookmarkedRecipes,
  fetchPublicRecipes,
  fetchRecipes,
  updateRecipe,
} from '../../src/api';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('frontend API integration contract', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } });
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleError.mockRestore();
  });

  test('loads a signed-in user’s recipes with the bearer token', async () => {
    const recipes = [{ id: 'recipe-1', title: 'Tortillas' }];
    fetchMock.mockResolvedValue(response({ recipes }));

    await expect(fetchRecipes()).resolves.toEqual(recipes);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/recipes`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    });
  });

  test('returns an empty Vault safely when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(fetchRecipes()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  test('encodes multiple dietary filters in the Community request', async () => {
    fetchMock.mockResolvedValue(response({ recipes: [] }));

    await fetchPublicRecipes(['Gluten-Free', 'Dairy Free']);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/public?dietary=Gluten-Free&dietary=Dairy%20Free`,
    );
  });

  test('sends recipe edits using the expected method, headers, and body', async () => {
    fetchMock.mockResolvedValue(response({ id: 'recipe-1', title: 'Updated' }));
    const changes = { title: 'Updated' };

    await expect(updateRecipe('recipe-1', changes)).resolves.toMatchObject(changes);
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/recipes/recipe-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify(changes),
    });
  });

  test('surfaces the backend’s delete error message', async () => {
    fetchMock.mockResolvedValue(response({ detail: 'Recipe not found' }, 404));

    await expect(deleteRecipe('missing')).rejects.toThrow('Recipe not found');
  });

  test('rejects bookmarking when the user is signed out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(bookmarkRecipe('recipe-1')).rejects.toThrow('You must be logged in to bookmark.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('returns no bookmarks when the user is signed out', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(fetchBookmarkedRecipes()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
