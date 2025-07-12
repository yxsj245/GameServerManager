/**
 * GSM3 插件API客户端
 * 提供插件与主面板通信的接口
 */
class GSM3API {
  constructor() {
    this.baseURL = '/api/plugin-api'
    this.token = null
    this.initializeToken()
  }

  /**
   * 初始化token获取机制
   */
  initializeToken() {
    try {
      // 检查是否已经通过脚本注入设置了全局token
      if (window.gsm3Token) {
        this.token = window.gsm3Token
        console.log('Token已从全局变量获取:', this.token)
        return
      }
      
      // 检查是否已经通过脚本注入设置了token
      if (window.gsm3 && window.gsm3.token) {
        this.token = window.gsm3.token
        console.log('Token已从注入脚本获取')
        return
      }
      
      // 尝试从父窗口获取token
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'gsm3-get-token' }, '*')
      }
      
      console.log('正在初始化token...')
    } catch (error) {
      console.warn('Token初始化失败:', error)
    }

    // 监听token更新
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'gsm3-token-update') {
        this.token = event.data.token
        console.log('通过消息更新Token:', this.token)
      }
    })
    
    // 定期检查全局token变量
    const checkGlobalToken = () => {
      if (!this.token && window.gsm3Token) {
        this.token = window.gsm3Token
        console.log('从全局变量延迟获取Token:', this.token)
      }
    }
    
    // 每100ms检查一次，最多检查50次（5秒）
    let checkCount = 0
    const tokenChecker = setInterval(() => {
      checkGlobalToken()
      checkCount++
      if (this.token || checkCount >= 50) {
        clearInterval(tokenChecker)
      }
    }, 100)
  }

  /**
   * 发送HTTP请求
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-Request': 'true', // 添加插件标识
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error('API请求失败:', error)
      throw error
    }
  }

  // ==================== 系统信息API ====================

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    return await this.request('/system/status')
  }

  /**
   * 获取系统信息
   */
  async getSystemInfo() {
    return await this.request('/system/info')
  }

  // ==================== 实例管理API ====================

  /**
   * 获取所有实例列表
   */
  async getInstances() {
    return await this.request('/instances')
  }

  /**
   * 获取单个实例信息
   * @param {string} instanceId 实例ID
   */
  async getInstance(instanceId) {
    return await this.request(`/instances/${instanceId}`)
  }

  /**
   * 获取实例状态
   * @param {string} instanceId 实例ID
   */
  async getInstanceStatus(instanceId) {
    return await this.request(`/instances/${instanceId}/status`)
  }

  // ==================== 终端管理API ====================

  /**
   * 获取终端会话列表
   */
  async getTerminals() {
    return await this.request('/terminals')
  }

  // ==================== 游戏管理API ====================

  /**
   * 获取游戏列表
   */
  async getGames() {
    return await this.request('/games')
  }

  // ==================== 通用API ====================

  /**
   * 获取API版本信息
   */
  async getVersion() {
    return await this.request('/version')
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return await this.request('/health')
  }

  // ==================== 工具方法 ====================

  /**
   * 显示通知消息（如果主面板支持）
   * @param {string} type 消息类型: 'info', 'success', 'warning', 'error'
   * @param {string} message 消息内容
   */
  showNotification(type, message) {
    try {
      // 尝试向父窗口发送通知消息
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'gsm3-notification',
          data: { type, message }
        }, '*')
      } else {
        // 如果无法发送到父窗口，使用浏览器原生通知
        console.log(`[${type.toUpperCase()}] ${message}`)
      }
    } catch (error) {
      console.warn('发送通知失败:', error)
    }
  }

  /**
   * 格式化字节大小
   * @param {number} bytes 字节数
   * @param {number} decimals 小数位数
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  /**
   * 格式化时间戳
   * @param {string|number|Date} timestamp 时间戳
   */
  formatTime(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  /**
   * 格式化运行时间
   * @param {number} seconds 秒数
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    const parts = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`)
    
    return parts.join(' ')
  }
}

// 创建全局实例
window.gsm3 = new GSM3API()

// 添加初始化状态标记
window.gsm3.isInitialized = false
window.gsm3.initPromise = null

// 初始化API的Promise
window.gsm3.initialize = function() {
  if (this.initPromise) {
    return this.initPromise
  }
  
  this.initPromise = new Promise((resolve) => {
    const checkReady = () => {
      if (this.token) {
        this.isInitialized = true
        console.log('GSM3 API初始化完成，Token:', this.token)
        resolve(true)
      } else {
        setTimeout(checkReady, 100)
      }
    }
    checkReady()
  })
  
  return this.initPromise
}

// 监听来自父窗口的消息
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'gsm3-token-update') {
    window.gsm3.token = event.data.token
    console.log('Token已更新:', event.data.token)
  }
})

// 插件加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('GSM3 插件API已加载')
  
  // 启动初始化过程
  window.gsm3.initialize().then(() => {
    console.log('GSM3 API准备就绪')
    
    // 向父窗口发送插件加载完成的消息
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'gsm3-plugin-loaded',
        data: { timestamp: new Date().toISOString() }
      }, '*')
    }
  })
})