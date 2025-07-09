import express from 'express'
import { createServer } from 'http'
import type { Socket } from 'net'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import winston from 'winston'
import { promises as fs } from 'fs'

import { TerminalManager } from './modules/terminal/TerminalManager.js'
import { GameManager } from './modules/game/GameManager.js'
import { SystemManager } from './modules/system/SystemManager.js'
import { ConfigManager } from './modules/config/ConfigManager.js'
import { AuthManager } from './modules/auth/AuthManager.js'
import { InstanceManager } from './modules/instance/InstanceManager.js'
import { SteamCMDManager } from './modules/steamcmd/SteamCMDManager.js'
import { setupTerminalRoutes } from './routes/terminal.js'
import { setupGameRoutes } from './routes/games.js'
import { setupSystemRoutes } from './routes/system.js'
import { setupAuthRoutes } from './routes/auth.js'
import { setAuthManager } from './middleware/auth.js'
import filesRouter from './routes/files.js'
import { setupInstanceRoutes } from './routes/instances.js'
import steamcmdRouter, { setSteamCMDManager } from './routes/steamcmd.js'
import gameDeploymentRouter, { setGameDeploymentManagers } from './routes/gameDeployment.js'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
// 首先尝试加载根目录的.env文件，然后加载server目录的.env文件
dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config()

// 配置日志
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gsm3-server' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

// 创建Express应用
const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
})

// 追踪所有活动的socket连接
const sockets = new Set<Socket>()
server.on('connection', socket => {
  sockets.add(socket)
  socket.on('close', () => {
    sockets.delete(socket)
  })
})

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: false // 开发环境下禁用CSP
}))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, '../public')))
app.use(express.static(path.join(__dirname, '../public')))

// 管理器变量声明
let configManager: ConfigManager
let authManager: AuthManager
let terminalManager: TerminalManager
let gameManager: GameManager
let systemManager: SystemManager
let instanceManager: InstanceManager
let steamcmdManager: SteamCMDManager

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'GSM3 Server',
    version: '1.0.0',
    description: '游戏面板后端服务',
    endpoints: {
      health: '/api/health',
      terminal: '/api/terminal',
      game: '/api/game',
      system: '/api/system'
    }
  })
})

// Socket.IO 连接处理将在startServer函数中设置

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('未处理的错误:', err)
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  })
})

// 404处理将在startServer函数中设置

// 优雅关闭处理
let shuttingDown = false
function gracefulShutdown(signal: string) {
  if (shuttingDown) {
    logger.warn('已在关闭中，忽略重复信号。')
    return
  }
  shuttingDown = true

  logger.info(`收到${signal}信号，开始优雅关闭...`)

  // 1. 立即清理所有管理器，特别是会创建子进程的TerminalManager
  logger.info('开始清理管理器...')
  try {
    if (terminalManager) {
      terminalManager.cleanup()
      logger.info('TerminalManager 已清理')
    }
    if (gameManager) {
      gameManager.cleanup()
      logger.info('GameManager 已清理')
    }
    if (systemManager) {
      systemManager.cleanup()
      logger.info('SystemManager 已清理')
    }
    if (instanceManager) {
      instanceManager.cleanup()
      logger.info('InstanceManager 已清理')
    }
    if (steamcmdManager) {
      // SteamCMDManager 通常不需要特殊清理，但为了一致性保留
      logger.info('SteamCMDManager 已清理')
    }
    logger.info('管理器清理完成。')
  } catch (cleanupErr) {
    logger.error('清理管理器时出错:', cleanupErr)
  }

  // 2. 关闭服务器
  logger.info('开始关闭服务器...')
  // 强制销毁所有活动的socket
  logger.info(`正在销毁 ${sockets.size} 个活动的socket...`)
  for (const socket of sockets) {
    socket.destroy()
  }

  server.close(err => {
    if (err && (err as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
      logger.error('关闭HTTP服务器时出错:', err)
    } else {
      logger.info('HTTP服务器已关闭。')
    }
    // 无论HTTP服务器关闭是否出错，都准备退出
    logger.info('优雅关闭完成，服务器退出。')
    process.exit(0)
  })

  io.close(() => {
    logger.info('Socket.IO 服务器已关闭')
  })

  // 3. 设置超时强制退出
  setTimeout(() => {
    logger.error('优雅关闭超时，强制退出！')
    process.exit(1)
  }, 5000) // 5秒超时
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason)
  process.exit(1)
})

// 启动服务器
async function startServer() {
  try {
    // 确保uploads目录存在
    const uploadsDir = path.join(process.cwd(), 'uploads')
    try {
      await fs.access(uploadsDir)
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true })
      logger.info(`创建uploads目录: ${uploadsDir}`)
    }

    // 删除之前的终端会话文件
    const terminalSessionsPath = path.join(process.cwd(), 'data', 'terminal-sessions.json')
    try {
      await fs.unlink(terminalSessionsPath)
      logger.info('已删除之前的终端会话文件')
    } catch (error: any) {
      // 文件不存在时忽略错误
      if (error.code !== 'ENOENT') {
        logger.warn('删除终端会话文件时出错:', error.message)
      }
    }

    // 初始化管理器
    configManager = new ConfigManager(logger)
    authManager = new AuthManager(configManager, logger)
    terminalManager = new TerminalManager(io, logger)
    gameManager = new GameManager(io, logger)
    systemManager = new SystemManager(io, logger)
    instanceManager = new InstanceManager(terminalManager, logger)
    steamcmdManager = new SteamCMDManager(logger, configManager)

    // 初始化配置和认证
    await configManager.initialize()
    await authManager.initialize()
    await terminalManager.initialize()
    await instanceManager.initialize()
    setAuthManager(authManager)

    // 设置路由
    app.use('/api/auth', setupAuthRoutes(authManager))
    app.use('/api/terminal', setupTerminalRoutes(terminalManager))
    app.use('/api/game', setupGameRoutes(gameManager))
    app.use('/api/system', setupSystemRoutes(systemManager))
    app.use('/api/files', filesRouter)
    app.use('/api/instances', setupInstanceRoutes(instanceManager))
    
    // 设置SteamCMD管理器和路由
    setSteamCMDManager(steamcmdManager, logger)
    app.use('/api/steamcmd', steamcmdRouter)
    
    // 设置游戏部署路由
    setGameDeploymentManagers(terminalManager, instanceManager, steamcmdManager, configManager)
    app.use('/api/game-deployment', gameDeploymentRouter)

    // 前端路由处理（SPA支持）
    app.get('*', (req, res) => {
      // 如果是API请求，返回404
      if (req.path.startsWith('/api/')) {
        res.status(404).json({
          error: '接口不存在',
          path: req.originalUrl
        })
      } else {
        // 其他请求返回前端页面
        res.sendFile(path.join(__dirname, '../public/index.html'))
      }
    })

    // Socket.IO 连接处理
    io.on('connection', (socket) => {
      logger.info(`客户端连接: ${socket.id}`)
      
      // 终端相关事件
      socket.on('create-pty', (data) => {
        // 将前端的cwd参数映射到后端的workingDirectory
        const mappedData = {
          ...data,
          workingDirectory: data.cwd || data.workingDirectory
        }
        delete mappedData.cwd
        terminalManager.createPty(socket, mappedData)
      })
      
      socket.on('terminal-input', (data) => {
        terminalManager.handleInput(socket, data)
      })
      
      socket.on('terminal-resize', (data) => {
        terminalManager.resizeTerminal(socket, data)
      })
      
      socket.on('close-pty', (data) => {
        terminalManager.closePty(socket, data)
      })
      
      socket.on('reconnect-session', (data) => {
        const success = terminalManager.reconnectSession(socket, data.sessionId)
        if (success) {
          socket.emit('session-reconnected', { sessionId: data.sessionId })
        } else {
          socket.emit('session-reconnect-failed', { sessionId: data.sessionId })
        }
      })
      
      // 游戏管理事件
      socket.on('game-start', (data) => {
        gameManager.startGame(socket, data)
      })
      
      socket.on('game-stop', (data) => {
        gameManager.stopGame(socket, data)
      })
      
      socket.on('game-command', (data) => {
        gameManager.sendCommand(socket, data.gameId, data.command)
      })

      // 系统监控事件
      socket.on('subscribe-system-stats', () => {
        socket.join('system-stats')
        logger.info(`客户端 ${socket.id} 开始订阅系统状态`)
      })

      socket.on('unsubscribe-system-stats', () => {
        socket.leave('system-stats')
        logger.info(`客户端 ${socket.id} 取消订阅系统状态`)
      })

      // 断开连接处理
      socket.on('disconnect', (reason) => {
        logger.info(`客户端断开连接: ${socket.id}, 原因: ${reason}`)
        terminalManager.handleDisconnect(socket)
        socket.leave('system-stats')
      })
      
      // 错误处理
      socket.on('error', (error) => {
        logger.error(`Socket错误 ${socket.id}:`, error)
      })
    })

    const PORT = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001', 10)
    const HOST = process.env.HOST || '0.0.0.0'

    server.listen(PORT, HOST, () => {
      logger.info(`GSM3服务器启动成功!`)
      logger.info(`地址: http://${HOST}:${PORT}`)
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`进程ID: ${process.pid}`)
    })
  } catch (error) {
    logger.error('服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()

export { app, server, io, logger }