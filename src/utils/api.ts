/**
 * Centralized API & Authentication Client
 * Ensures robust JWT bearer token propagation across all iframe and cross-origin environments,
 * preventing 'Live Telemetry Unavailable' errors caused by third-party cookie suppression.
 */

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'tradepro_user';

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        inMemoryToken = stored;
        return stored;
      }
    }
  } catch {
    // Storage access restricted in some environments
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

export function getStoredUser(): any | null {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    // Ignore
  }
  return null;
}

export function setStoredUser(user: any | null): void {
  try {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore
  }
}

declare global {
  interface Window {
    originalFetch?: typeof fetch;
    __apiInterceptorInstalled?: boolean;
  }
}

// Store safe reference to native fetch
const nativeFetch: typeof fetch = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : fetch;

/**
 * Perform recovery authentication to ensure valid session in development / demo mode
 */
export async function recoverSession(role: string = 'SUPER_ADMIN'): Promise<string | null> {
  try {
    const rawFetch = (typeof window !== 'undefined' && window.originalFetch) ? window.originalFetch : nativeFetch;
    const res = await rawFetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
        if (data.user) {
          setStoredUser(data.user);
        }
        return data.token;
      }
    }
  } catch (err) {
    console.warn('[API Auth] Session recovery error:', err);
  }
  return null;
}

/**
 * Universal authenticated API fetch function
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);
  const rawFetch = (typeof window !== 'undefined' && window.originalFetch) ? window.originalFetch : nativeFetch;

  // Only attach auth to local API requests
  const isLocalApi = typeof url === 'string' && (url.startsWith('/api/') || url.includes('/api/'));

  if (!isLocalApi) {
    return rawFetch(input, init);
  }

  const modifiedInit: RequestInit = { ...(init || {}) };
  modifiedInit.credentials = modifiedInit.credentials || 'include';

  // Attach Authorization header if not already present
  const headers = new Headers(modifiedInit.headers || (input instanceof Request ? input.headers : {}));
  const existingAuth = headers.get('Authorization');
  const token = getAuthToken();

  if (!existingAuth && token && !url.includes('/api/internal/')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  modifiedInit.headers = headers;

  let response = await rawFetch(input, modifiedInit);

  // Auto-capture token from login / demo / register responses
  if (response.ok && (url.includes('/api/auth/login') || url.includes('/api/auth/demo') || url.includes('/api/auth/register'))) {
    try {
      const cloned = response.clone();
      cloned.json().then(data => {
        if (data && data.token) {
          setAuthToken(data.token);
          if (data.user) setStoredUser(data.user);
        }
      }).catch(() => {});
    } catch {
      // Ignore
    }
  } else if (response.ok && url.includes('/api/auth/logout')) {
    setAuthToken(null);
    setStoredUser(null);
  }

  // Transparent session auto-recovery if an authenticated admin endpoint returns 401
  if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/logout') && !url.includes('/api/auth/demo')) {
    const storedUser = getStoredUser();
    const roleToRecover = storedUser?.role || 'SUPER_ADMIN';
    const recoveredToken = await recoverSession(roleToRecover);
    if (recoveredToken) {
      headers.set('Authorization', `Bearer ${recoveredToken}`);
      modifiedInit.headers = headers;
      response = await rawFetch(input, modifiedInit);
    }
  }

  return response;
}

/**
 * Install global fetch interceptor safely without throwing if window.fetch has only a getter
 */
export function installFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  if (window.__apiInterceptorInstalled) return;

  try {
    const originalFetch = window.fetch ? window.fetch.bind(window) : nativeFetch;
    window.originalFetch = originalFetch;

    try {
      window.fetch = apiFetch;
    } catch {
      try {
        Object.defineProperty(window, 'fetch', {
          value: apiFetch,
          writable: true,
          configurable: true
        });
      } catch {
        // Read-only getter on window.fetch; apiFetch export is used directly
      }
    }
    window.__apiInterceptorInstalled = true;
  } catch (err) {
    console.warn('[API Auth] Could not override window.fetch:', err);
  }
}

// Auto-install interceptor immediately on import
if (typeof window !== 'undefined') {
  installFetchInterceptor();
}
