import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: API });

const ACCESS = "rw_access";
const REFRESH = "rw_refresh";

export async function getAccess() {
  return SecureStore.getItemAsync(ACCESS);
}
export async function setTokens(access: string | null, refresh?: string | null) {
  if (access) await SecureStore.setItemAsync(ACCESS, access);
  else await SecureStore.deleteItemAsync(ACCESS);
  if (refresh !== undefined) {
    if (refresh) await SecureStore.setItemAsync(REFRESH, refresh);
    else await SecureStore.deleteItemAsync(REFRESH);
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refresh = await SecureStore.getItemAsync(REFRESH);
      if (refresh) {
        const res = await axios.post(`${API}/auth/refresh/`, { refresh });
        await setTokens(res.data.access, res.data.refresh || refresh);
        error.config.headers.Authorization = `Bearer ${res.data.access}`;
        return api(error.config);
      }
    }
    return Promise.reject(error);
  },
);
