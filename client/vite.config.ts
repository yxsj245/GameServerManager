import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// 获取后端服务端口
const getServerPort = () => {
  return process.env.VITE_SERVER_PORT || process.env.SERVER_PORT || '3001'
}

// 获取前端开发端口
const getClientPort = () => {
  return parseInt(process.env.VITE_CLIENT_PORT || process.env.CLIENT_PORT || '5173', 10)
}

const serverPort = getServerPort()
const clientPort = getClientPort()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  server: {
    port: clientPort,
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})