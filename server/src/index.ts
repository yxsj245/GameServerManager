import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import winston from 'winston'

import { TerminalManager } from './modules/terminal/TerminalManager'
import { GameManager } from './modules/game/GameManager'
import { SystemManager } from './modules/system/SystemManager'
import { ConfigManager } from './modules/config/ConfigManager'
import { AuthManager } from './modules/auth/AuthManager'
import { setupTerminalRoutes } from './routes/terminal'
import { setupGameRoutes } from './routes/games'
import { setupSystemRoutes } from './routes/system'
import { setupAuthRoutes } from './routes/auth'
import { setAuthManager } from './middleware/auth'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
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
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
})

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: false // 开发环境下禁用CSP
}))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, '../public')))

// 管理器变量声明
let configManager: ConfigManager
let authManager: AuthManager
let terminalManager: TerminalManager
let gameManager: GameManager
let systemManager: SystemManager

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
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...')
  server.close(() => {
    logger.info('HTTP服务器已关闭')
    terminalManager.cleanup()
    gameManager.cleanup()
    systemManager.cleanup()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...')
  server.close(() => {
    logger.info('HTTP服务器已关闭')
    terminalManager.cleanup()
    gameManager.cleanup()
    systemManager.cleanup()
    process.exit(0)
  })
})

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
    // 初始化管理器
    configManager = new ConfigManager(logger)
    authManager = new AuthManager(configManager, logger)
    terminalManager = new TerminalManager(io, logger)
    gameManager = new GameManager(io, logger)
    systemManager = new SystemManager(io, logger)

    // 初始化配置和认证
    await configManager.initialize()
    await authManager.initialize()
    setAuthManager(authManager)

    // 设置路由
    app.use('/api/auth', setupAuthRoutes(authManager))
    app.use('/api/terminal', setupTerminalRoutes(terminalManager))
    app.use('/api/game', setupGameRoutes(gameManager))
    app.use('/api/system', setupSystemRoutes(systemManager))

    // 404处理（必须在所有路由之后）
    app.use('*', (req, res) => {
      res.status(404).json({
        error: '接口不存在',
        path: req.originalUrl
      })
    })

    // Socket.IO 连接处理
    io.on('connection', (socket) => {
      logger.info(`客户端连接: ${socket.id}`)
      
      // 终端相关事件
      socket.on('create-pty', (data) => {
        terminalManager.createPty(socket, data)
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

    const PORT = parseInt(process.env.PORT || '3001', 10)
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