/**
 * Layer: Frontend Infrastructure
 * Responsibility: Implements the Http helper that centralizes shared client-side plumbing for the web console.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// frontend/src/lib/http.ts
import axios, { AxiosRequestConfig } from 'axios';

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Configure API base URL:
// - Leave VITE_API_BASE_URL empty to use same-origin requests (recommended for LAN/mobile via Vite proxy).
// - Set VITE_API_BASE_URL (for example http://192.168.1.10:3001) when direct API access is needed.
export const AXIOS_INSTANCE = axios.create({
    // Default to same-origin requests for better LAN/mobile testing support.
    // Generated endpoints already include `/api/...`.
    baseURL: normalizedBaseUrl || undefined,
});

// 拦截器：每次请求前，自动加 Token
AXIOS_INSTANCE.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// 自定义实例函数 (Orval 使用)
export const customInstance = <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig,
): Promise<T> => {
    const source = axios.CancelToken.source();
    const promise = AXIOS_INSTANCE({
        ...config,
        ...options,
        cancelToken: source.token,
    }).then(({ data }) => data);

    // @ts-ignore
    promise.cancel = () => {
        source.cancel('Query was cancelled');
    };

    return promise;
};
