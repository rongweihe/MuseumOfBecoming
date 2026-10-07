import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 相对资源路径兼容根站点和仓库子目录；路由交给 hash，不依赖服务端重写。
export default defineConfig({ plugins: [react()], base: './', build: { target: 'es2022' } });
