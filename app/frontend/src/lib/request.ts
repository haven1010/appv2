/**
 * Layer: Frontend Infrastructure
 * Responsibility: Implements the Request helper that centralizes shared client-side plumbing for the web console.
 * Notes: Keep comments focused on intent, invariants, side effects, and cross-module contracts.
 */
// frontend/src/lib/request.ts

// 如果你用了环境变量
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const request = async (endpoint: string, options: RequestInit = {}) => {
    // 确保 endpoint 不以 / 开头 (或者处理一下拼接逻辑)
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            // 如果有 token 鉴权，在这里添加
            // 'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        ...options,
    });

    if (!response.ok) {
        throw new Error('API request failed');
    }

    return response.json();
};