import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type SocialAuthProvider = 'apple' | 'google';

// On web, the OAuth redirect opens this app in a temporary callback window.
// Completing that browser session sends the URL back to the original window,
// which is the only window that should exchange the returned credentials.
export const browserAuthSessionCompletion = (() => {
  try {
    return WebBrowser.maybeCompleteAuthSession();
  } catch {
    return { type: 'failed' as const, message: 'No browser auth session to complete.' };
  }
})();

function getSessionParameters(url: string) {
  const parsedUrl = new URL(url);
  const searchParameters = parsedUrl.searchParams;
  const hashParameters = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const read = (key: string) => searchParameters.get(key) ?? hashParameters.get(key);

  return {
    accessToken: read('access_token'),
    refreshToken: read('refresh_token'),
    authorizationCode: read('code'),
    error: read('error_description') ?? read('error'),
  };
}

export async function createSessionFromUrl(url: string) {
  const parameters = getSessionParameters(url);
  if (parameters.error) throw new Error(parameters.error);

  if (parameters.authorizationCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(parameters.authorizationCode);
    if (error) throw error;
    return;
  }

  if (!parameters.accessToken || !parameters.refreshToken) {
    throw new Error('The sign-in provider returned without a valid session.');
  }

  const { data: existingSessionData } = await supabase.auth.getSession();
  if (existingSessionData.session?.access_token === parameters.accessToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: parameters.accessToken,
    refresh_token: parameters.refreshToken,
  });
  if (error) throw error;
}

export function getAuthRedirectUrl(path = 'auth/callback') {
  return Linking.createURL(path);
}

export async function signInWithSocialProvider(provider: SocialAuthProvider) {
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error(`Could not start ${provider} sign-in.`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { completed: false as const };

  await createSessionFromUrl(result.url);
  return { completed: true as const };
}
