const TOKEN_KEY = 'diet_admin_token';

export function getRequestHeaders(
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    'Content-Type': 'application/json',
    ...customHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function isLoggedIn(): boolean {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && token.trim().length > 0;
  } catch {
    return false;
  }
}

export function clearAuthTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('diet_admin_user');
}

export default { getRequestHeaders, isLoggedIn, clearAuthTokens };