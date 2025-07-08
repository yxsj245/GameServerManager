import { spawn, ChildProcess } from 'child_process'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PtySession {
  id: string
  process: ChildProcess
  socket: Socket
  workingDirectory: string
  createdAt: Date
  lastActivity: Date
  disconnected?: boolean
  disconnectedAt?: Date
  outputBuffer: string[] // 存储终端输出历史
}

interface CreatePtyData {
  sessionId: string
  cols: number
  rows: number
  workingDirectory?: string
}

interface TerminalInputData {
  sessionId: string
  data: string
}

interface TerminalResizeData {
  sessionId: string
  cols: number
  rows: number
}

export class TerminalManager {
  private sessions: Map<string, PtySession> = new Map()
  private io: SocketIOServer
  private logger: winston.Logger
  private ptyPath: string

  constructor(io: SocketIOServer, logger: winston.Logger) {
    this.io = io
    this.logger = logger
    
    // 根据操作系统选择PTY程序路径
    const platform = os.platform()
    if (platform === 'win32') {
      this.ptyPath = path.resolve(__dirname, '../../../PTY/pty_win32_x64.exe')
    } else {
      this.ptyPath = path.resolve(__dirname, '../../../PTY/pty_linux_x64')
    }
    
    this.logger.info(`终端管理器初始化完成，PTY路径: ${this.ptyPath}`)
    
    // 定期清理不活跃的会话
    setInterval(() => {
      this.cleanupInactiveSessions()
    }, 60000) // 每分钟检查一次
  }

  /**
   * 创建新的PTY会话
   */
  public createPty(socket: Socket, data: CreatePtyData): void {
    try {
      const { sessionId, cols, rows, workingDirectory = process.cwd() } = data
      
      this.logger.info(`创建PTY会话: ${sessionId}, 大小: ${cols}x${rows}`)
      
      // 检查会话是否已存在
      if (this.sessions.has(sessionId)) {
        this.logger.warn(`会话 ${sessionId} 已存在，先关闭旧会话`)
        this.closePty(socket, { sessionId })
      }
      
      // 构建PTY命令参数
      const args = [
        '-dir', workingDirectory,
        '-size', `${cols},${rows}`,
        '-coder', 'UTF-8'
      ]
      
      // 根据操作系统设置默认shell
      if (os.platform() === 'win32') {
        args.push('-cmd', JSON.stringify(['powershell.exe']))
      } else {
        args.push('-cmd', JSON.stringify(['/bin/bash']))
      }
      
      this.logger.info(`启动PTY进程: ${this.ptyPath} ${args.join(' ')}`)
      
      // 启动PTY进程
      const ptyProcess = spawn(this.ptyPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDirectory,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      })
      
      this.logger.info(`PTY进程已启动，PID: ${ptyProcess.pid}`)
      
      // 创建会话对象
      const session: PtySession = {
        id: sessionId,
        process: ptyProcess,
        socket,
        workingDirectory,
        createdAt: new Date(),
        lastActivity: new Date(),
        outputBuffer: [] // 初始化输出缓存
      }
      
      this.sessions.set(sessionId, session)
      
      // 处理PTY输出
      ptyProcess.stdout?.on('data', (data: Buffer) => {
        session.lastActivity = new Date()
        const output = data.toString()
        
        // 保存到输出缓存，限制缓存大小为1000条
        session.outputBuffer.push(output)
        if (session.outputBuffer.length > 1000) {
          session.outputBuffer.shift() // 移除最旧的输出
        }
        
        this.logger.debug(`PTY输出 ${sessionId}: ${JSON.stringify(output)}`)
        socket.emit('terminal-output', {
          sessionId,
          data: output
        })
      })
      
      // 处理PTY错误输出
      ptyProcess.stderr?.on('data', (data: Buffer) => {
        session.lastActivity = new Date()
        const output = data.toString()
        
        // 保存到输出缓存，限制缓存大小为1000条
        session.outputBuffer.push(output)
        if (session.outputBuffer.length > 1000) {
          session.outputBuffer.shift() // 移除最旧的输出
        }
        
        this.logger.warn(`PTY错误输出 ${sessionId}: ${JSON.stringify(output)}`)
        socket.emit('terminal-output', {
          sessionId,
          data: output
        })
      })
      
      // 处理进程退出
      ptyProcess.on('exit', (code, signal) => {
        this.logger.info(`PTY进程退出: ${sessionId}, 退出码: ${code}, 信号: ${signal}`)
        socket.emit('terminal-exit', {
          sessionId,
          code: code || 0,
          signal
        })
        this.sessions.delete(sessionId)
      })
      
      // 处理进程错误
      ptyProcess.on('error', (error) => {
        this.logger.error(`PTY进程错误 ${sessionId}:`, error)
        socket.emit('terminal-error', {
          sessionId,
          error: error.message
        })
        this.sessions.delete(sessionId)
      })
      
      // 发送创建成功事件
      socket.emit('pty-created', {
        sessionId,
        workingDirectory
      })
      
      this.logger.info(`PTY会话创建成功: ${sessionId}`)
      
      // 发送初始欢迎信息和提示符
      setTimeout(() => {
        if (ptyProcess.stdin && !ptyProcess.stdin.destroyed) {
          // 发送一个回车来触发初始提示符
          ptyProcess.stdin.write('\r')
        }
      }, 500) // 延迟500ms确保PTY完全初始化
      
    } catch (error) {
      this.logger.error(`创建PTY会话失败:`, error)
      socket.emit('terminal-error', {
        sessionId: data.sessionId,
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  /**
   * 处理终端输入
   */
  public handleInput(socket: Socket, data: TerminalInputData): void {
    try {
      const { sessionId, data: inputData } = data
      const session = this.sessions.get(sessionId)
      
      if (!session) {
        this.logger.warn(`会话不存在: ${sessionId}`)
        socket.emit('terminal-error', {
          sessionId,
          error: '会话不存在'
        })
        return
      }
      
      // 如果会话之前断开连接，现在重新连接
      if (session.disconnected) {
        session.disconnected = false
        session.disconnectedAt = undefined
        session.socket = socket
        this.logger.info(`会话 ${sessionId} 重新连接成功`)
      }
      
      // 更新最后活动时间
      session.lastActivity = new Date()
      
      // 发送输入到PTY进程
      if (session.process.stdin && !session.process.stdin.destroyed) {
        session.process.stdin.write(inputData)
      } else {
        this.logger.warn(`PTY进程stdin不可用: ${sessionId}`)
      }
      
    } catch (error) {
      this.logger.error(`处理终端输入失败:`, error)
      socket.emit('terminal-error', {
        sessionId: data.sessionId,
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  /**
   * 调整终端大小
   */
  public resizeTerminal(socket: Socket, data: TerminalResizeData): void {
    try {
      const { sessionId, cols, rows } = data
      const session = this.sessions.get(sessionId)
      
      if (!session) {
        this.logger.warn(`会话不存在: ${sessionId}`)
        return
      }
      
      this.logger.info(`调整终端大小: ${sessionId}, ${cols}x${rows}`)
      
      // 更新最后活动时间
      session.lastActivity = new Date()
      
      // 发送调整大小命令到PTY进程
      // 注意：这里需要根据PTY程序的具体实现来调整
      // 目前的PTY程序可能不支持动态调整大小，这里只是示例
      
    } catch (error) {
      this.logger.error(`调整终端大小失败:`, error)
    }
  }

  /**
   * 关闭PTY会话
   */
  public closePty(socket: Socket, data: { sessionId: string }): void {
    try {
      const { sessionId } = data
      const session = this.sessions.get(sessionId)
      
      if (!session) {
        this.logger.warn(`尝试关闭不存在的会话: ${sessionId}`)
        return
      }
      
      this.logger.info(`关闭PTY会话: ${sessionId}`)
      
      // 终止PTY进程
      if (!session.process.killed) {
        session.process.kill('SIGTERM')
        
        // 如果进程在3秒内没有退出，强制杀死
        setTimeout(() => {
          if (!session.process.killed) {
            session.process.kill('SIGKILL')
          }
        }, 3000)
      }
      
      // 从会话列表中移除
      this.sessions.delete(sessionId)
      
      // 通知客户端会话已关闭
      socket.emit('pty-closed', { sessionId })
      
    } catch (error) {
      this.logger.error(`关闭PTY会话失败:`, error)
    }
  }

  /**
   * 处理客户端断开连接
   */
  public handleDisconnect(socket: Socket): void {
    try {
      // 找到属于该socket的所有会话并标记为断开状态
      const sessionsToMark: string[] = []
      
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.socket.id === socket.id) {
          sessionsToMark.push(sessionId)
        }
      }
      
      for (const sessionId of sessionsToMark) {
        const session = this.sessions.get(sessionId)
        if (session) {
          // 标记会话为断开状态，但不关闭PTY进程
          session.disconnected = true
          session.disconnectedAt = new Date()
          this.logger.info(`会话 ${sessionId} 已标记为断开状态`)
        }
      }
      
      if (sessionsToMark.length > 0) {
        this.logger.info(`客户端断开连接，标记了 ${sessionsToMark.length} 个会话为断开状态`)
      }
      
    } catch (error) {
      this.logger.error(`处理客户端断开连接失败:`, error)
    }
  }

  /**
   * 清理不活跃的会话
   */
  private cleanupInactiveSessions(): void {
    try {
      const now = new Date()
      const inactiveThreshold = 30 * 60 * 1000 // 30分钟
      const disconnectedThreshold = 5 * 60 * 1000 // 断开连接5分钟后清理
      const sessionsToClose: string[] = []
      
      for (const [sessionId, session] of this.sessions.entries()) {
        const inactiveTime = now.getTime() - session.lastActivity.getTime()
        const disconnectedTime = session.disconnectedAt ? now.getTime() - session.disconnectedAt.getTime() : 0
        
        // 如果会话断开连接超过5分钟，或者不活跃超过30分钟，则清理
        if ((session.disconnected && disconnectedTime > disconnectedThreshold) || 
            (!session.disconnected && inactiveTime > inactiveThreshold)) {
          sessionsToClose.push(sessionId)
        }
      }
      
      for (const sessionId of sessionsToClose) {
        const session = this.sessions.get(sessionId)
        if (session) {
          this.logger.info(`清理会话: ${sessionId} (${session.disconnected ? '断开连接' : '不活跃'})`)
          this.closePty(session.socket, { sessionId })
        }
      }
      
    } catch (error) {
      this.logger.error(`清理不活跃会话失败:`, error)
    }
  }

  /**
   * 重新连接现有会话
   */
  public reconnectSession(socket: Socket, sessionId: string): boolean {
    try {
      const session = this.sessions.get(sessionId)
      
      if (!session) {
        this.logger.warn(`尝试重连不存在的会话: ${sessionId}`)
        return false
      }
      
      // 更新socket连接
      session.socket = socket
      session.disconnected = false
      session.disconnectedAt = undefined
      session.lastActivity = new Date()

      // 发送历史输出
      if (session.outputBuffer.length > 0) {
        const history = session.outputBuffer.join('')
        socket.emit('terminal-output', {
          sessionId,
          data: history
        })
      }
      
      this.logger.info(`会话 ${sessionId} 重新连接成功`)
      
      // 重新设置PTY输出监听
      session.process.stdout?.removeAllListeners('data')
      session.process.stderr?.removeAllListeners('data')
      
      // 发送历史输出给重连的客户端
      if (session.outputBuffer.length > 0) {
        const historicalOutput = session.outputBuffer.join('')
        socket.emit('terminal-output', {
          sessionId: session.id,
          data: historicalOutput,
          isHistorical: true
        })
      }
      
      session.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        
        // 保存到输出缓存，限制缓存大小为1000条
        session.outputBuffer.push(output)
        if (session.outputBuffer.length > 1000) {
          session.outputBuffer.shift() // 移除最旧的输出
        }
        
        socket.emit('terminal-output', {
          sessionId: session.id,
          data: output
        })
      })
      
      session.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        
        // 保存到输出缓存，限制缓存大小为1000条
        session.outputBuffer.push(output)
        if (session.outputBuffer.length > 1000) {
          session.outputBuffer.shift() // 移除最旧的输出
        }
        
        socket.emit('terminal-output', {
          sessionId: session.id,
          data: output
        })
      })
      
      return true
    } catch (error) {
      this.logger.error(`重连会话失败:`, error)
      return false
    }
  }
  
  /**
   * 获取活跃会话统计
   */
  public getSessionStats(): { total: number; sessions: Array<{ id: string; createdAt: Date; lastActivity: Date; disconnected?: boolean }> } {
    const sessions = Array.from(this.sessions.values())
      .map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        disconnected: session.disconnected
      }))
    
    return {
      total: sessions.length,
      sessions
    }
  }

  /**
   * 清理所有会话
   */
  public cleanup(): void {
    this.logger.info('开始清理所有终端会话...')
    
    for (const [sessionId, session] of this.sessions.entries()) {
      try {
        if (!session.process.killed) {
          session.process.kill('SIGTERM')
        }
      } catch (error) {
        this.logger.error(`清理会话 ${sessionId} 失败:`, error)
      }
    }
    
    this.sessions.clear()
    this.logger.info('所有终端会话已清理完成')
  }
}