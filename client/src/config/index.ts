// 前端配置文件

// 获取完整的服务器URL
function getServerUrl(): string {
  // 对于Vite开发服务器代理和生产环境，相对路径是最佳选择。
  // serverUrl为空字符串将使socket.io连接到源，
  // API调用也将使用相对路径。
  return ''
}

// 获取API基础URL
function getApiBaseUrl(): string {
  // 所有的API请求都以/api为前缀
  return '/api'
}

// 导出配置
export const config = {
  serverUrl: getServerUrl(),
  apiBaseUrl: getApiBaseUrl(),
  
  // 其他配置
  requestTimeout: 0, // 取消超时限制
  socketTimeout: 20000,
}

export default config