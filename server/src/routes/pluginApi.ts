import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import type { InstanceManager } from '../modules/instance/InstanceManager.js'
import type { SystemManager } from '../modules/system/SystemManager.js'
import type { TerminalManager } from '../modules/terminal/TerminalManager.js'
import type { GameManager } from '../modules/game/GameManager.js'
import logger from '../utils/logger.js'

const router = Router()

// 依赖注入
let instanceManager: InstanceManager
let systemManager: SystemManager
let terminalManager: TerminalManager
let gameManager: GameManager

export function setPluginApiDependencies(
  instManager: InstanceManager,
  sysManager: SystemManager,
  termManager: TerminalManager,
  gmManager: GameManager
) {
  instanceManager = instManager
  systemManager = sysManager
  terminalManager = termManager
  gameManager = gmManager
}

// 插件API代理中间件
const pluginApiProxy = (req: Request, res: Response, next: any) => {
  // 验证请求来源是否为插件
  const isPluginRequest = req.get('X-Plugin-Request') === 'true'
  
  if (!isPluginRequest) {
    // 为了兼容开发环境，我们允许来自 about:srcdoc 的请求
    const referer = req.get('Referer')
    if (process.env.NODE_ENV === 'development' && referer === 'about:srcdoc') {
      return next()
    }

    return res.status(403).json({
      success: false,
      message: '仅允许插件调用此API'
    })
  }
  
  next()
}

// 应用插件API代理中间件
router.use(pluginApiProxy)
router.use(authenticateToken)

// ==================== 系统信息API ====================

// 获取系统状态
router.get('/system/status', async (req: Request, res: Response) => {
  try {
    if (!systemManager) {
      return res.status(503).json({
        success: false,
        message: '系统管理器未初始化'
      })
    }

    const status = await systemManager.getSystemInfo()
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('插件获取系统状态失败:', error)
    res.status(500).json({
      success: false,
      message: '获取系统状态失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 获取系统信息
router.get('/system/info', async (req: Request, res: Response) => {
  try {
    if (!systemManager) {
      return res.status(503).json({
        success: false,
        message: '系统管理器未初始化'
      })
    }

    const info = await systemManager.getSystemInfo()
    res.json({
      success: true,
      data: info
    })
  } catch (error) {
    logger.error('插件获取系统信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取系统信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// ==================== 实例管理API ====================

// 获取实例列表
router.get('/instances', async (req: Request, res: Response) => {
  try {
    if (!instanceManager) {
      return res.status(503).json({
        success: false,
        message: '实例管理器未初始化'
      })
    }

    const instances = instanceManager.getInstances()
    res.json({
      success: true,
      data: instances
    })
  } catch (error) {
    logger.error('插件获取实例列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取实例列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 获取单个实例信息
router.get('/instances/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    if (!instanceManager) {
      return res.status(503).json({
        success: false,
        message: '实例管理器未初始化'
      })
    }

    const instance = instanceManager.getInstance(id)
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: '实例不存在'
      })
    }

    res.json({
      success: true,
      data: instance
    })
  } catch (error) {
    logger.error('插件获取实例信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取实例信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 获取实例状态
router.get('/instances/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    if (!instanceManager) {
      return res.status(503).json({
        success: false,
        message: '实例管理器未初始化'
      })
    }

    const instance = instanceManager.getInstance(id)
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: '实例不存在'
      })
    }

    const status = await instanceManager.getInstanceStatus(id)
    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('插件获取实例状态失败:', error)
    res.status(500).json({
      success: false,
      message: '获取实例状态失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// ==================== 终端管理API ====================

// 获取终端会话列表
router.get('/terminals', async (req: Request, res: Response) => {
  try {
    if (!terminalManager) {
      return res.status(503).json({
        success: false,
        message: '终端管理器未初始化'
      })
    }

    const terminals = terminalManager.getSessionStats()
    res.json({
      success: true,
      data: terminals
    })
  } catch (error) {
    logger.error('插件获取终端列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取终端列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// ==================== 游戏管理API ====================

// 获取游戏列表
router.get('/games', async (req: Request, res: Response) => {
  try {
    if (!gameManager) {
      return res.status(503).json({
        success: false,
        message: '游戏管理器未初始化'
      })
    }

    const games = gameManager.getGames()
    res.json({
      success: true,
      data: games
    })
  } catch (error) {
    logger.error('插件获取游戏列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取游戏列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// ==================== 通用API ====================

// 获取API版本信息
router.get('/version', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      apiVersion: 'v1',
      pluginApiVersion: '1.0.0',
      timestamp: new Date().toISOString()
    }
  })
})

// 健康检查
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })
})

export default router