import winston from 'winston'
import path from 'path'
import fs from 'fs'

// 确保日志目录存在
const logDir = path.resolve(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
  })
)

// 创建日志器
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 终端日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'terminal.log'),
      level: 'info',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [TERMINAL]: ${message}`
        })
      )
    }),
    
    // 游戏日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'games.log'),
      level: 'info',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [GAMES]: ${message}`
        })
      )
    }),
    
    // 系统监控日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'system.log'),
      level: 'info',
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [SYSTEM]: ${message}`
        })
      )
    })
  ],
  
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ],
  
  // 处理未处理的Promise拒绝
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3
    })
  ]
})

// 创建专用日志器
export const terminalLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message }) => {
      return `${timestamp} ${message}`
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'terminal.log'),
      maxsize: 50 * 1024 * 1024,
      maxFiles: 3,
      tailable: true
    })
  ]
})

export const gameLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message }) => {
      return `${timestamp} ${message}`
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'games.log'),
      maxsize: 50 * 1024 * 1024,
      maxFiles: 3,
      tailable: true
    })
  ]
})

export const systemLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, message }) => {
      return `${timestamp} ${message}`
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'system.log'),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 3,
      tailable: true
    })
  ]
})

// 在生产环境中不输出到控制台
if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports[0]) // 移除控制台传输
}

export default logger