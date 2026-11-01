import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_API_URL = 'yama_api_base_url';
// Default fallback: local development port 7080 (or customize via Settings screen)
export const DEFAULT_API_URL = 'http://localhost:7080';

let cachedApiUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
    if (saved && saved.trim()) {
      const sanitized = saved.trim().replace(/\/$/, '');
      cachedApiUrl = sanitized;
      return cachedApiUrl;
    }
  } catch (e) {
    console.warn('Failed to read saved API URL:', e);
  }
  cachedApiUrl = DEFAULT_API_URL;
  return cachedApiUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const sanitized = url.trim().replace(/\/$/, '');
  cachedApiUrl = sanitized;
  await AsyncStorage.setItem(STORAGE_KEY_API_URL, sanitized);
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson.message) {
        errorMsg = errJson.message;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
