/**
 * Layer: Frontend Infrastructure
 * Responsibility: Implements the Http helper that centralizes shared client-side plumbing for the web console.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// frontend/src/lib/http.ts
import axios, { AxiosRequestConfig } from 'axios';

// 🔥 修改这里！
// 1. 去掉 '/api'，因为生成的代码里自带了
// 2. 直接写后端地址 http://localhost:3001 (因为后端开了 CORS，允许 3000 访问)
export const AXIOS_INSTANCE = axios.create({
    baseURL: 'http://localhost:3001',
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