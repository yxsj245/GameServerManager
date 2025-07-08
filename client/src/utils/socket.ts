import { io, Socket } from 'socket.io-client'
import { SocketEvents } from '@/types'
import config from '@/config'

class SocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Function[]> = new Map()

  constructor() {
    this.connect()
  }

  private connect() {
    const token = localStorage.getItem('gsm3_token')
    
    this.socket = io(config.serverUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      timeout: config.socketTimeout,
      forceNew: true,
    })

    this.setupEventListeners()
  }

  private setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket连接成功:', this.socket?.id)
      this.reconnectAttempts = 0
      this.emit('connection-status', { connected: true })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket断开连接:', reason)
      this.emit('connection-status', { connected: false, reason })
      
      if (reason === 'io server disconnect') {
        // 服务器主动断开，需要重新连接
        this.reconnect()
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket连接错误:', error)
      this.emit('connection-error', { error: error.message })
      this.reconnect()
    })

    this.socket.on('error', (error) => {
      console.error('Socket错误:', error)
      this.emit('socket-error', { error })
    })

    // 认证错误处理
    this.socket.on('auth-error', (error) => {
      console.error('Socket认证错误:', error)
      this.emit('auth-error', { error })
      // 清除token并重定向到登录页
      localStorage.removeItem('gsm3_token')
      window.location.href = '/login'
    })
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连')
      this.emit('max-reconnect-attempts', {})
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连...`)
    
    setTimeout(() => {
      if (this.socket) {
        this.socket.connect()
      }
    }, delay)
  }

  // 发送事件
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket未连接，无法发送事件:', event)
    }
  }

  // 监听事件
  on<K extends keyof SocketEvents>(event: K, callback: SocketEvents[K]): void
  on(event: string, callback: Function): void
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    
    this.listeners.get(event)!.push(callback)
    
    if (this.socket) {
      this.socket.on(event, callback as any)
    }
  }

  // 取消监听事件
  off(event: string, callback?: Function) {
    if (callback) {
      const listeners = this.listeners.get(event)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
      
      if (this.socket) {
        this.socket.off(event, callback as any)
      }
    } else {
      // 移除所有监听器
      this.listeners.delete(event)
      if (this.socket) {
        this.socket.off(event)
      }
    }
  }

  // 一次性监听
  once(event: string, callback: Function) {
    if (this.socket) {
      this.socket.once(event, callback as any)
    }
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // 获取Socket ID
  getId(): string | undefined {
    return this.socket?.id
  }

  // 手动重连
  reconnectManually() {
    this.reconnectAttempts = 0
    if (this.socket) {
      this.socket.connect()
    } else {
      this.connect()
    }
  }

  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  // 更新认证token
  updateAuth(token: string) {
    if (this.socket) {
      this.socket.auth = { token }
      this.socket.disconnect().connect()
    }
  }

  // 终端相关方法
  createTerminal(data: { sessionId: string; name?: string; cols?: number; rows?: number }) {
    this.emit('create-pty', data)
  }

  sendTerminalInput(sessionId: string, data: string) {
    this.emit('terminal-input', { sessionId, data })
  }

  resizeTerminal(sessionId: string, cols: number, rows: number) {
    this.emit('terminal-resize', { sessionId, cols, rows })
  }

  closeTerminal(sessionId: string) {
    this.emit('close-pty', { sessionId })
  }

  // 系统监控相关方法
  subscribeSystemStats() {
    this.emit('subscribe-system-stats')
  }

  unsubscribeSystemStats() {
    this.emit('unsubscribe-system-stats')
  }

  // 游戏服务器相关方法
  startGame(gameId: string) {
    this.emit('game-start', { gameId })
  }

  stopGame(gameId: string) {
    this.emit('game-stop', { gameId })
  }

  sendGameCommand(gameId: string, command: string) {
    this.emit('game-command', { gameId, command })
  }

  // 订阅游戏服务器状态
  subscribeGameStatus(gameId: string) {
    this.emit('subscribe-game-status', { gameId })
  }

  unsubscribeGameStatus(gameId: string) {
    this.emit('unsubscribe-game-status', { gameId })
  }
}

// 创建单例实例
const socketClient = new SocketClient()

export default socketClient
export { SocketClient }