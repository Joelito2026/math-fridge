const mockCreateUrl = jest.fn();
const mockMaybeCompleteAuthSession = jest.fn(() => ({ type: 'success' }));
const mockOpenAuthSessionAsync = jest.fn();
const mockGetSession = jest.fn();
const mockSetSession = jest.fn();
const mockExchangeCodeForSession = jest.fn();
const mockSignInWithOAuth = jest.fn();

jest.mock('expo-linking', () => ({
  createURL: (...args: unknown[]) => mockCreateUrl(...args),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => mockMaybeCompleteAuthSession(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

import {
  createSessionFromUrl,
  getAuthRedirectUrl,
  signInWithSocialProvider,
} from '../../src/services/socialAuth';

describe('social sign-in integrity', () => {
  beforeEach(() => {
    mockCreateUrl.mockReturnValue('frontend://auth/callback');
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSetSession.mockResolvedValue({ error: null });
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockSignInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.example.test/oauth' }, error: null });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'frontend://auth/callback?code=authorization-code',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses the app callback as the OAuth redirect URL', () => {
    expect(getAuthRedirectUrl()).toBe('frontend://auth/callback');
    expect(mockCreateUrl).toHaveBeenCalledWith('auth/callback');
  });

  test('exchanges an authorization code without exposing tokens to the app', async () => {
    await expect(createSessionFromUrl('frontend://auth/callback?code=one-time-code')).resolves.toBeUndefined();
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  test('accepts session tokens only when both access and refresh tokens are present', async () => {
    await createSessionFromUrl('frontend://auth/callback#access_token=access&refresh_token=refresh');

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    });
  });

  test('does not overwrite an already matching session after a duplicate callback', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'access' } } });

    await createSessionFromUrl('frontend://auth/callback#access_token=access&refresh_token=refresh');

    expect(mockSetSession).not.toHaveBeenCalled();
  });

  test('rejects provider errors and incomplete callbacks without creating a session', async () => {
    await expect(createSessionFromUrl('frontend://auth/callback?error_description=Access%20denied'))
      .rejects.toThrow('Access denied');
    await expect(createSessionFromUrl('frontend://auth/callback#access_token=access'))
      .rejects.toThrow('The sign-in provider returned without a valid session.');

    expect(mockSetSession).not.toHaveBeenCalled();
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  test('surfaces a rejected authorization-code exchange', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error('Invalid authorization code') });

    await expect(createSessionFromUrl('frontend://auth/callback?code=bad-code'))
      .rejects.toThrow('Invalid authorization code');
  });

  test('starts Google OAuth with the safe callback and completes the returned session', async () => {
    await expect(signInWithSocialProvider('google')).resolves.toEqual({ completed: true });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'frontend://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.example.test/oauth',
      'frontend://auth/callback',
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('authorization-code');
  });

  test('does not create a session when the user cancels the provider window', async () => {
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    await expect(signInWithSocialProvider('google')).resolves.toEqual({ completed: false });
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  test('does not open a provider window when Supabase cannot provide an OAuth URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    await expect(signInWithSocialProvider('google')).rejects.toThrow('Could not start google sign-in.');
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });
});
