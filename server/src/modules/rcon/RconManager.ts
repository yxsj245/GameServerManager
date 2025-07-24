import net from 'net'
import { EventEmitter } from 'events'
import logger from '../../utils/logger.js'

// RCON数据包类型
enum PacketType {
  SERVERDATA_AUTH = 3,
  SERVERDATA_AUTH_RESPONSE = 2,
  SERVERDATA_EXECCOMMAND = 2,
  SERVERDATA_RESPONSE_VALUE = 0
}

// RCON配置接口
export interface RconConfig {
  host: string
  port: number
  password: string
  timeout?: number
}

// RCON连接状态
export enum RconStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

// RCON数据包结构
interface RconPacket {
  id: number
  type: number
  body: string
}

export class RconManager extends EventEmitter {
  private socket: net.Socket | null = null
  private status: RconStatus = RconStatus.DISCONNECTED
  private config: RconConfig | null = null
  private requestId = 1
  private pendingRequests = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>()
  private buffer = Buffer.alloc(0)

  constructor() {
    super()
  }

  // 连接到RCON服务器
  async connect(config: RconConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status === RconStatus.CONNECTED || this.status === RconStatus.AUTHENTICATED) {
        return resolve()
      }

      this.config = config
      this.status = RconStatus.CONNECTING
      this.emit('statusChange', this.status)

      this.socket = new net.Socket()
      this.socket.setTimeout(config.timeout || 5000)

      this.socket.on('connect', () => {
        logger.info(`RCON连接成功: ${config.host}:${config.port}`)
        this.status = RconStatus.CONNECTED
        this.emit('statusChange', this.status)
        this.authenticate(config.password).then(resolve).catch(reject)
      })

      this.socket.on('data', (data) => {
        this.handleData(data)
      })

      this.socket.on('error', (error) => {
        logger.error('RCON连接错误:', error)
        this.status = RconStatus.ERROR
        this.emit('statusChange', this.status)
        this.emit('error', error)
        reject(error)
      })

      this.socket.on('close', () => {
        logger.info('RCON连接已关闭')
        this.status = RconStatus.DISCONNECTED
        this.emit('statusChange', this.status)
        this.emit('disconnect')
        this.cleanup()
      })

      this.socket.on('timeout', () => {
        logger.error('RCON连接超时')
        this.status = RconStatus.ERROR
        this.emit('statusChange', this.status)
        this.emit('error', new Error('连接超时'))
        this.disconnect()
        reject(new Error('连接超时'))
      })

      this.socket.connect(config.port, config.host)
    })
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy()
    }
    this.cleanup()
  }

  // 清理资源
  private cleanup(): void {
    this.socket = null
    this.status = RconStatus.DISCONNECTED
    this.buffer = Buffer.alloc(0)
    
    // 清理所有待处理的请求
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout)
      request.reject(new Error('连接已断开'))
    }
    this.pendingRequests.clear()
  }

  // 身份验证
  private async authenticate(password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const packet = this.createPacket(PacketType.SERVERDATA_AUTH, password)
      const requestId = packet.id

      this.sendPacket(packet)

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('身份验证超时'))
      }, 5000)

      this.pendingRequests.set(requestId, {
        resolve: (response: RconPacket) => {
          clearTimeout(timeout)
          if (response.id === requestId) {
            this.status = RconStatus.AUTHENTICATED
            this.emit('statusChange', this.status)
            logger.info('RCON身份验证成功')
            resolve()
          } else {
            reject(new Error('身份验证失败'))
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timeout
      })
    })
  }

  // 执行命令
  async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.status !== RconStatus.AUTHENTICATED) {
        return reject(new Error('RCON未连接或未认证'))
      }

      const packet = this.createPacket(PacketType.SERVERDATA_EXECCOMMAND, command)
      const requestId = packet.id

      this.sendPacket(packet)

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('命令执行超时'))
      }, 10000)

      this.pendingRequests.set(requestId, {
        resolve: (response: RconPacket) => {
          clearTimeout(timeout)
          resolve(response.body)
        },
        reject: (error: Error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timeout
      })
    })
  }

  // 创建RCON数据包
  private createPacket(type: number, body: string): RconPacket {
    const id = this.requestId++
    return { id, type, body }
  }

  // 发送数据包
  private sendPacket(packet: RconPacket): void {
    if (!this.socket) {
      throw new Error('Socket未连接')
    }

    const bodyBuffer = Buffer.from(packet.body, 'utf8')
    const length = 4 + 4 + bodyBuffer.length + 2 // id + type + body + 2个null字节
    
    const buffer = Buffer.alloc(4 + length)
    let offset = 0

    // 写入长度
    buffer.writeInt32LE(length, offset)
    offset += 4

    // 写入ID
    buffer.writeInt32LE(packet.id, offset)
    offset += 4

    // 写入类型
    buffer.writeInt32LE(packet.type, offset)
    offset += 4

    // 写入主体
    bodyBuffer.copy(buffer, offset)
    offset += bodyBuffer.length

    // 写入两个null字节
    buffer.writeUInt8(0, offset)
    buffer.writeUInt8(0, offset + 1)

    this.socket.write(buffer)
  }

  // 处理接收到的数据
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])

    while (this.buffer.length >= 4) {
      const length = this.buffer.readInt32LE(0)
      
      if (this.buffer.length < 4 + length) {
        // 数据不完整，等待更多数据
        break
      }

      // 解析数据包
      const packet = this.parsePacket(this.buffer.slice(4, 4 + length))
      this.buffer = this.buffer.slice(4 + length)

      // 处理数据包
      this.handlePacket(packet)
    }
  }

  // 解析数据包
  private parsePacket(buffer: Buffer): RconPacket {
    const id = buffer.readInt32LE(0)
    const type = buffer.readInt32LE(4)
    const body = buffer.slice(8, buffer.length - 2).toString('utf8')

    return { id, type, body }
  }

  // 处理数据包
  private handlePacket(packet: RconPacket): void {
    const request = this.pendingRequests.get(packet.id)
    
    if (request) {
      this.pendingRequests.delete(packet.id)
      
      if (packet.type === PacketType.SERVERDATA_AUTH_RESPONSE) {
        // 身份验证响应
        if (packet.id === -1) {
          request.reject(new Error('身份验证失败：密码错误'))
        } else {
          request.resolve(packet)
        }
      } else if (packet.type === PacketType.SERVERDATA_RESPONSE_VALUE) {
        // 命令执行响应
        request.resolve(packet)
      }
    }

    // 发出数据包事件
    this.emit('packet', packet)
  }

  // 获取连接状态
  getStatus(): RconStatus {
    return this.status
  }

  // 获取配置信息
  getConfig(): RconConfig | null {
    return this.config
  }

  // 检查是否已连接
  isConnected(): boolean {
    return this.status === RconStatus.AUTHENTICATED
  }
}

export default RconManager