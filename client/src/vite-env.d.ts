/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_PORT?: string
  readonly VITE_CLIENT_PORT?: string
  // 更多环境变量可以在这里添加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}