import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { LoginRequest, LoginResponse, ApiResponse, User, Instance, CreateInstanceRequest, CaptchaResponse, CheckCaptchaResponse } from '@/types'
import config from '@/config'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response
      },
      (error) => {
        if (error.response?.status === 401) {
          // 只记录认证失败信息，不自动跳转登录页面
          console.warn('认证失败，请检查登录状态')
          // 不再自动清除token和跳转，让用户手动处理
        }
        return Promise.reject(error)
      }
    )

    // 从localStorage恢复token
    this.loadToken()
  }

  private loadToken() {
    const token = localStorage.getItem('gsm3_token')
    if (token) {
      this.setToken(token)
    }
  }

  setToken(token: string) {
    this.token = token
    localStorage.setItem('gsm3_token', token)
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('gsm3_token')
    localStorage.removeItem('gsm3_user')
  }

  getToken(): string | null {
    return this.token
  }

  // 通用请求方法
  private async request<T = any>(
    config: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config)
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        throw error.response.data
      }
      throw {
        success: false,
        error: '网络错误',
        message: error.message || '请求失败，请检查网络连接',
      }
    }
  }

  // GET请求
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  // POST请求
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  // PUT请求
  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  // DELETE请求
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }

  // PATCH请求
  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data })
  }

  // 认证相关API
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await this.client.post<LoginResponse>('/auth/login', credentials)
      const result = response.data
      
      if (result.success && result.token) {
        this.setToken(result.token)
        if (result.user) {
          localStorage.setItem('gsm3_user', JSON.stringify(result.user))
        }
      }
      
      return result
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        message: error.message || '登录失败，请检查网络连接',
      }
    }
  }

  async getCaptcha(): Promise<CaptchaResponse> {
    try {
      const response = await this.client.get<CaptchaResponse>('/auth/captcha')
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        captcha: { id: '', svg: '' }
      }
    }
  }

  async checkCaptchaRequired(username: string): Promise<CheckCaptchaResponse> {
    try {
      const response = await this.client.post<CheckCaptchaResponse>('/auth/check-captcha', { username })
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        requireCaptcha: false
      }
    }
  }

  async verifyToken(): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const response = await this.client.get('/auth/verify')
      return response.data
    } catch (error: any) {
      // 不再自动清除token，让调用方决定如何处理
      return {
        success: false,
        message: error.response?.data?.message || 'Token验证失败',
      }
    }
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post('/auth/logout')
      this.clearToken()
      return response.data
    } catch (error: any) {
      this.clearToken()
      return {
        success: true,
        message: '已登出',
      }
    }
  }

  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.post('/auth/change-password', {
        oldPassword,
        newPassword,
      })
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        message: error.message || '修改密码失败',
      }
    }
  }

  async changeUsername(
    newUsername: string
  ): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      const response = await this.client.post('/auth/change-username', {
        newUsername,
      })
      
      // 如果修改成功，更新本地存储的用户信息
      if (response.data.success && response.data.user) {
        localStorage.setItem('gsm3_user', JSON.stringify(response.data.user))
      }
      
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data
      }
      return {
        success: false,
        message: error.message || '修改用户名失败',
      }
    }
  }

  // 系统相关API
  async getSystemStats() {
    return this.get('/system/stats')
  }

  async getActivePorts() {
    return this.get('/system/ports')
  }

  async getSystemInfo() {
    return this.get('/system/info')
  }

  async getProcessList() {
    return this.get('/system/processes')
  }

  async getActiveTerminalProcesses() {
    return this.get('/terminal/active-processes')
  }

  // 终端相关API
  async getTerminalSessions() {
    return this.get('/terminal/sessions')
  }

  async createTerminalSession(name?: string) {
    return this.post('/terminal/create', { name })
  }

  async closeTerminalSession(sessionId: string) {
    return this.post('/terminal/close', { sessionId })
  }

  async updateTerminalSessionName(sessionId: string, name: string) {
    return this.put(`/terminal/sessions/${sessionId}/name`, { name })
  }

  // 游戏相关API
  async getGameServers() {
    return this.get('/game/servers')
  }

  async createGameServer(config: any) {
    return this.post('/game/create', config)
  }

  async startGameServer(gameId: string) {
    return this.post(`/game/${gameId}/start`)
  }

  async stopGameServer(gameId: string) {
    return this.post(`/game/${gameId}/stop`)
  }

  async deleteGameServer(gameId: string) {
    return this.delete(`/game/${gameId}`)
  }

  // 文件管理API
  async getFiles(path: string) {
    return this.get('/files', { params: { path } })
  }

  async uploadFile(file: File, path: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('path', path)
    
    return this.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  async downloadFile(path: string) {
    try {
      const response = await this.client.get('/files/download', {
        params: { path },
        responseType: 'blob',
      })
      return response.data
    } catch (error) {
      throw error
    }
  }

  async deleteFile(path: string) {
    return this.delete('/files', { params: { path } })
  }

  async createFolder(path: string, name: string) {
    return this.post('/files/folder', { path, name })
  }

  // 实例管理API
  async getInstances() {
    return this.get<Instance[]>('/instances')
  }

  async createInstance(data: CreateInstanceRequest) {
    return this.post<Instance>('/instances', data)
  }

  async updateInstance(id: string, data: CreateInstanceRequest) {
    return this.put<Instance>(`/instances/${id}`, data)
  }

  async deleteInstance(id: string) {
    return this.delete(`/instances/${id}`)
  }

  async startInstance(id: string) {
    return this.post(`/instances/${id}/start`)
  }

  async stopInstance(id: string) {
    return this.post(`/instances/${id}/stop`)
  }

  async closeTerminal(id: string) {
    return this.post(`/instances/${id}/close-terminal`)
  }

  async getInstanceStatus(id: string) {
    return this.get(`/instances/${id}/status`)
  }

  // 实例市场API
  async getMarketInstances() {
    return this.get('/instances/market')
  }

  // 游戏部署API
  async getInstallableGames() {
    return this.get('/game-deployment/games')
  }

  async installGame(data: {
    gameKey: string
    gameName: string
    appId: string
    installPath: string
    instanceName: string
    useAnonymous: boolean
    steamUsername?: string
    steamPassword?: string
    steamcmdCommand: string
  }) {
    return this.post('/game-deployment/install', data)
  }

  // 定时任务API
  async getScheduledTasks() {
    return this.get('/scheduled-tasks')
  }

  async createScheduledTask(data: any) {
    return this.post('/scheduled-tasks', data)
  }

  async updateScheduledTask(id: string, data: any) {
    return this.put(`/scheduled-tasks/${id}`, data)
  }

  async deleteScheduledTask(id: string) {
    return this.delete(`/scheduled-tasks/${id}`)
  }

  async toggleScheduledTask(id: string, enabled: boolean) {
    return this.patch(`/scheduled-tasks/${id}/toggle`, { enabled })
  }

  // Minecraft服务端API
  async getMinecraftServerCategories() {
    return this.get('/minecraft/server-categories')
  }

  async getMinecraftVersions(server: string) {
    return this.get(`/minecraft/versions/${server}`)
  }

  async getMinecraftDownloadInfo(server: string, version: string) {
    return this.get(`/minecraft/download-info/${server}/${version}`)
  }

  async downloadMinecraftServer(data: {
    server: string
    version: string
    targetDirectory: string
    skipJavaCheck?: boolean
    skipServerRun?: boolean
    socketId?: string
  }) {
    return this.post('/minecraft/download', data)
  }

  async cancelMinecraftDownload(downloadId: string) {
    return this.post('/minecraft/cancel-download', { downloadId })
  }

  async createMinecraftInstance(data: {
    name: string
    description?: string
    workingDirectory: string
    serverType: string
    version: string
    javaPath?: string
    javaArgs?: string
    serverArgs?: string
    maxMemory?: number
    minMemory?: number
  }) {
    return this.post('/minecraft/create-instance', data)
  }

  async validateJavaEnvironment() {
    return this.get('/minecraft/validate-java')
  }

  // 更多游戏部署API
  async getMoreGames() {
    return this.get('/more-games/games')
  }

  async getMoreGameInfo(gameId: string) {
    return this.get(`/more-games/games/${gameId}`)
  }

  async deployTModLoader(data: {
    installPath: string
    options?: {
      deleteAfterExtract?: boolean
      clearExtractDir?: boolean
      createVersionDir?: boolean
    }
    socketId?: string
  }) {
    return this.post('/more-games/deploy/tmodloader', data)
  }

  async deployFactorio(data: {
    installPath: string
    options?: {
      tempDir?: string
    }
    socketId?: string
  }) {
    return this.post('/more-games/deploy/factorio', data)
  }

  async getMoreGameDeploymentStatus(gameId: string, installPath: string) {
    return this.get(`/more-games/status/${gameId}/${encodeURIComponent(installPath)}`)
  }

  async getMoreGameVersion(gameId: string) {
    return this.get(`/more-games/version/${gameId}`)
  }

  async cancelMoreGameDeployment(deploymentId: string) {
    return this.post('/more-games/cancel-deployment', { deploymentId })
  }

  // Minecraft整合包API
  async searchMrpackModpacks(options: {
    query?: string
    limit?: number
    offset?: number
    categories?: string[]
    versions?: string[]
    loaders?: string[]
  } = {}) {
    const params = new URLSearchParams()
    if (options.query) params.append('query', options.query)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.categories) params.append('categories', options.categories.join(','))
    if (options.versions) params.append('versions', options.versions.join(','))
    if (options.loaders) params.append('loaders', options.loaders.join(','))
    
    return this.get(`/more-games/mrpack/search?${params.toString()}`)
  }

  async getMrpackProjectVersions(projectId: string) {
    return this.get(`/more-games/mrpack/project/${projectId}/versions`)
  }

  async deployMrpack(data: {
    projectId: string
    versionId: string
    installPath: string
    options?: {
      javaPath?: string
      maxMemory?: string
      minMemory?: string
    }
    socketId?: string
  }) {
    return this.post('/more-games/deploy/mrpack', data)
  }

  // 游戏配置文件API
  async getAvailableConfigs() {
    return this.get('/instances/configs/available')
  }

  async getConfigSchema(configId: string) {
    return this.get(`/instances/configs/schema/${encodeURIComponent(configId)}`)
  }

  async readGameConfig(instanceId: string, configId: string) {
    return this.get(`/instances/${instanceId}/configs/${encodeURIComponent(configId)}`)
  }

  async saveGameConfig(instanceId: string, configId: string, configData: any) {
    return this.post(`/instances/${instanceId}/configs/${encodeURIComponent(configId)}`, { configData })
  }

  // Python环境检测API
  async checkPythonEnvironment() {
    return this.get('/instances/python/check')
  }
}

// 创建单例实例
const apiClient = new ApiClient()

export default apiClient
export { ApiClient }