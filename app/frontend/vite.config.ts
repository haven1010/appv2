import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, '.', '');

  return {
    // 插件配置
    plugins: [react()],

    // 路径别名配置
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },

    // 环境变量定义
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    // 服务器与代理配置
    server: {
      port: 3000,      // 前端端口
      host: '0.0.0.0', // 允许局域网访问

      // 反向代理配置 (解决跨域)
      proxy: {
        '/api': {
          target: 'http://localhost:3001', // 后端地址
          changeOrigin: true,              // 允许跨域
          secure: false,                   // 忽略 SSL 验证
        }
      }
    }
  };
});