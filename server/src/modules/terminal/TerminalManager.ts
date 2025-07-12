import { spawn, ChildProcess } from 'child_process'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import { promisify } from 'util'
import { exec } from 'child_process'
import { TerminalSessionManager, PersistedTerminalSession } from './TerminalSessionManager.js'

const execAsync = promisify(exec)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PtySession {
  id: string
  name: string // 终端会话名称
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
  name?: string // 会话名称
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
  private sessionManager: TerminalSessionManager

  constructor(io: SocketIOServer, logger: winston.Logger) {
    this.io = io
    this.logger = logger
    this.sessionManager = new TerminalSessionManager(logger)
    
    // 根据操作系统和架构选择PTY程序路径
    const platform = os.platform()
    const arch = os.arch()
    
    if (platform === 'win32') {
      // this.ptyPath = path.resolve(__dirname, '../../../PTY/pty_win32_x64.exe')
      this.ptyPath = path.resolve(__dirname, '../../PTY/pty_win32_x64.exe')
    } else {
      // Linux平台根据架构选择对应的PTY文件
      if (arch === 'arm64' || arch === 'aarch64') {
        // this.ptyPath = path.resolve(__dirname, '../../../PTY/pty_linux_arm64')
        this.ptyPath = path.resolve(__dirname, '../../PTY/pty_linux_arm64')
      } else {
        // this.ptyPath = path.resolve(__dirname, '../../../PTY/pty_linux_x64')
        this.ptyPath = path.resolve(__dirname, '../../PTY/pty_linux_x64')
      }
    }
    
    this.logger.info(`终端管理器初始化完成，PTY路径: ${this.ptyPath}`)
    
    // 定期清理不活跃的会话
    setInterval(() => {
      this.cleanupInactiveSessions()
    }, 5 * 60 * 1000) // 每5分钟检查一次
    
    // 定期清理过期的持久化会话
    setInterval(() => {
      this.sessionManager.cleanupExpiredSessions()
    }, 24 * 60 * 60 * 1000) // 每24小时清理一次
  }
  
  /**
   * 初始化终端管理器
   */
  async initialize(): Promise<void> {
    await this.sessionManager.initialize()
  }

  /**
   * 创建新的PTY会话
   */
  public createPty(socket: Socket, data: CreatePtyData): void {
    try {
      const { sessionId, name, cols, rows, workingDirectory = process.cwd() } = data
      const sessionName = name || `终端会话 ${sessionId.slice(-8)}`
      
      this.logger.info(`创建PTY会话: ${sessionId} (${sessionName}), 大小: ${cols}x${rows}`)
      
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
        name: sessionName,
        process: ptyProcess,
        socket,
        workingDirectory,
        createdAt: new Date(),
        lastActivity: new Date(),
        outputBuffer: []
      }
      
      // 保存会话到内存
      this.sessions.set(sessionId, session)
      
      // 持久化保存会话信息
      this.sessionManager.saveSession({
        id: sessionId,
        name: sessionName,
        workingDirectory,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        isActive: true
      }).catch(error => {
        this.logger.error(`保存会话到配置文件失败: ${sessionId}`, error)
      })
      
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
      
      // 注意：由于PTY进程的限制，我们无法直接获取当前终端大小
      // 这里直接进行大小调整操作，让PTY进程处理实际的大小变化
      
      // 由于当前PTY程序在启动时设置固定大小，动态调整大小功能有限
      // 我们只发送SIGWINCH信号通知进程窗口大小变化，不发送可见的命令到终端
      
      // 发送SIGWINCH信号通知子进程窗口大小变化
      try {
        if (session.process.pid && !session.process.killed) {
          process.kill(session.process.pid, 'SIGWINCH')
          this.logger.info(`已发送SIGWINCH信号调整终端大小: ${sessionId}, ${cols}x${rows}`)
        }
      } catch (signalError) {
        this.logger.debug(`发送SIGWINCH信号失败: ${signalError}`)
      }
      
      // 通知前端大小调整完成
      session.socket.emit('terminal-resized', {
        sessionId,
        cols,
        rows
      })
      
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
      
      // 从持久化存储中移除会话
      this.sessionManager.removeSession(sessionId).catch(error => {
        this.logger.error(`从配置文件删除会话失败: ${sessionId}`, error)
      })
      
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
          session.lastActivity = new Date()
          
          // 更新持久化状态
          this.sessionManager.setSessionActive(sessionId, false).catch(error => {
            this.logger.error(`更新会话断开状态失败: ${sessionId}`, error)
          })
          
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
      
      // 更新持久化状态
      this.sessionManager.setSessionActive(sessionId, true).catch(error => {
        this.logger.error(`更新会话重连状态失败: ${sessionId}`, error)
      })

      this.logger.info(`会话 ${sessionId} 重新连接成功`)
      
      // 重新设置PTY输出监听
      session.process.stdout?.removeAllListeners('data')
      session.process.stderr?.removeAllListeners('data')
      
      // 发送历史输出给重连的客户端（只发送一次）
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
   * 更新会话名称
   */
  public async updateSessionName(sessionId: string, newName: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId)
      
      if (!session) {
        this.logger.warn(`尝试更新不存在的会话名称: ${sessionId}`)
        return false
      }
      
      // 更新内存中的会话名称
      session.name = newName
      session.lastActivity = new Date()
      
      // 更新持久化存储中的会话名称
      await this.sessionManager.updateSessionName(sessionId, newName)
      
      this.logger.info(`会话名称已更新: ${sessionId} -> ${newName}`)
      return true
    } catch (error) {
      this.logger.error(`更新会话名称失败: ${sessionId}`, error)
      return false
    }
  }
  
  /**
   * 获取活跃会话统计
   */
  public getSessionStats(): { total: number; sessions: Array<{ id: string; name: string; createdAt: Date; lastActivity: Date; disconnected?: boolean }> } {
    const sessions = Array.from(this.sessions.values())
      .map(session => ({
        id: session.id,
        name: session.name,
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
   * 获取保存的会话列表
   */
  public getSavedSessions(): PersistedTerminalSession[] {
    return this.sessionManager.getSavedSessions()
  }

  /**
   * 获取活跃终端进程信息
   */
  public async getActiveTerminalProcesses(): Promise<Array<{ id: string; name: string; pid: number; cpu: number; memory: number; status: string; createdAt: string; command: string }>> {
    const activeProcesses: Array<{ id: string; name: string; pid: number; cpu: number; memory: number; status: string; createdAt: string; command: string }> = []
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session.disconnected && session.process && !session.process.killed) {
        const pid = session.process.pid || 0
        let cpu = 0
        let memory = 0
        
        // 获取进程的CPU和内存使用情况
        if (pid > 0) {
          try {
            const processStats = await this.getProcessStats(pid)
            cpu = processStats.cpu
            memory = processStats.memory
          } catch (error) {
            this.logger.warn(`获取进程 ${pid} 统计信息失败:`, error)
          }
        }
        
        activeProcesses.push({
          id: session.id,
          name: session.name,
          pid,
          cpu,
          memory,
          status: 'running',
          createdAt: session.createdAt.toISOString(),
          command: 'terminal session'
        })
      }
    }
    
    return activeProcesses
  }

  /**
   * 获取进程统计信息
   */
  private async getProcessStats(pid: number): Promise<{ cpu: number; memory: number }> {
    try {
      const platform = os.platform()
      
      if (platform === 'win32') {
        // Windows: 使用 wmic 命令获取进程信息
        const { stdout } = await execAsync(`wmic process where "ProcessId=${pid}" get PageFileUsage,WorkingSetSize /format:csv`)
        const lines = stdout.trim().split('\n')
        if (lines.length > 1) {
          const data = lines[1].split(',')
          const memory = parseInt(data[1]) || 0 // WorkingSetSize in bytes
          return { cpu: 0, memory: memory / 1024 / 1024 } // Convert to MB
        }
      } else {
        // Linux/Unix: 使用 ps 命令获取进程信息
        const { stdout } = await execAsync(`ps -p ${pid} -o %cpu,%mem --no-headers`)
        const parts = stdout.trim().split(/\s+/)
        if (parts.length >= 2) {
          const cpu = parseFloat(parts[0]) || 0
          const memory = parseFloat(parts[1]) || 0
          return { cpu, memory }
        }
      }
    } catch (error) {
      this.logger.warn(`获取进程 ${pid} 统计信息失败:`, error)
    }
    
    return { cpu: 0, memory: 0 }
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