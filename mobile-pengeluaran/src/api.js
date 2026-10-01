import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getDefaultApiUrl = () => {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.manifest?.debuggerHost ||
      Constants.manifest2?.extra?.expoGo?.hostUri;

    if (hostUri) {
      const ip = hostUri.split(':')[0];
      return `http://${ip}:3000`;
    }
  } catch (error) {
    // ignore and use built-in fallback below
  }

  if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
};

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || getDefaultApiUrl()).replace(/\/$/, '');

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (response.status === 204) return null;

    const raw = await response.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Respons bukan JSON (${response.status})`);
    }

    if (!response.ok) {
      const message = data?.pesan || data?.message || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Waktu tunggu habis. Periksa data sebelum mengulang.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export const api = {
list: () => request('/pengeluaran'),
detail: (id) => request(`/pengeluaran/${id}`),
categories: () => request('/kategori'),
create: (body) => request('/pengeluaran', {
method: 'POST', body: JSON.stringify(body),
}),
update: (id, body) => request(`/pengeluaran/${id}`, {
method: 'PUT', body: JSON.stringify(body),
}),
remove: (id) => request(`/pengeluaran/${id}`, { method: 'DELETE' }),
};