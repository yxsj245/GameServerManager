// 前端配置文件

// 获取后端服务端口
function getServerPort(): string {
  // 优先从环境变量读取（Vite会自动注入VITE_开头的环境变量）
  if (import.meta.env.VITE_SERVER_PORT) {
    return import.meta.env.VITE_SERVER_PORT
  }
  
  // 从URL参数读取
  const urlParams = new URLSearchParams(window.location.search)
  const portParam = urlParams.get('server_port')
  if (portParam) {
    return portParam
  }
  
  // 默认端口
  return '3001'
}

// 获取完整的服务器URL
function getServerUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const hostname = window.location.hostname
  const port = getServerPort()
  return `${protocol}//${hostname}:${port}`
}

// 获取API基础URL
function getApiBaseUrl(): string {
  return `${getServerUrl()}/api`
}

// 导出配置
export const config = {
  serverPort: getServerPort(),
  serverUrl: getServerUrl(),
  apiBaseUrl: getApiBaseUrl(),
  
  // 其他配置
  requestTimeout: 30000,
  socketTimeout: 20000,
}

export default config