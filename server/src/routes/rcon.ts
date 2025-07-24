import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import RconManager, { RconConfig, RconStatus } from '../modules/rcon/RconManager.js'
import logger from '../utils/logger.js'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

// 存储每个实例的RCON连接
const rconConnections = new Map<string, RconManager>()

// RCON配置存储路径
const getRconConfigPath = (instanceId: string): string => {
  const baseDir = process.cwd()
  const possiblePaths = [
    path.join(baseDir, 'data', 'rcon', `${instanceId}.json`),           // 打包后的路径
    path.join(baseDir, 'server', 'data', 'rcon', `${instanceId}.json`), // 开发环境路径
  ]
  
  // 返回第一个存在的目录路径，如果都不存在则返回第一个
  for (const configPath of possiblePaths) {
    const dir = path.dirname(configPath)
    try {
      require('fs').accessSync(dir)
      return configPath
    } catch {
      // 目录不存在，继续尝试下一个
    }
  }
  
  return possiblePaths[0] // 默认返回第一个路径
}

// 确保RCON配置目录存在
const ensureRconConfigDir = async (configPath: string): Promise<void> => {
  const dir = path.dirname(configPath)
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

// 获取实例的RCON配置
router.get('/:instanceId/config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const configPath = getRconConfigPath(instanceId)
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      // 不返回密码
      const safeConfig = {
        host: config.host,
        port: config.port,
        timeout: config.timeout
      }
      
      res.json({
        success: true,
        data: safeConfig
      })
    } catch (error) {
      // 配置文件不存在，返回默认配置
      res.json({
        success: true,
        data: {
          host: 'localhost',
          port: 25575,
          timeout: 5000
        }
      })
    }
  } catch (error: any) {
    logger.error('获取RCON配置失败:', error)
    res.status(500).json({
      success: false,
      error: '获取RCON配置失败',
      message: error.message
    })
  }
})

// 保存实例的RCON配置
router.post('/:instanceId/config', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const { host, port, password, timeout } = req.body
    
    if (!host || !port || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的配置参数'
      })
    }
    
    const config: RconConfig = {
      host,
      port: parseInt(port),
      password,
      timeout: timeout || 5000
    }
    
    const configPath = getRconConfigPath(instanceId)
    await ensureRconConfigDir(configPath)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    
    res.json({
      success: true,
      message: 'RCON配置已保存'
    })
  } catch (error: any) {
    logger.error('保存RCON配置失败:', error)
    res.status(500).json({
      success: false,
      error: '保存RCON配置失败',
      message: error.message
    })
  }
})

// 连接到RCON服务器
router.post('/:instanceId/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    
    // 如果已有连接，先断开
    const existingConnection = rconConnections.get(instanceId)
    if (existingConnection) {
      existingConnection.disconnect()
      rconConnections.delete(instanceId)
    }
    
    // 从配置文件读取连接参数
    const configPath = getRconConfigPath(instanceId)
    let config: RconConfig
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configData)
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: '未找到RCON配置，请先保存配置'
      })
    }
    
    // 验证配置参数
    if (!config.host || !config.port || !config.password) {
      return res.status(400).json({
        success: false,
        error: 'RCON配置不完整，请检查配置'
      })
    }
    
    const rconManager = new RconManager()
    
    // 设置事件监听器
    rconManager.on('statusChange', (status: RconStatus) => {
      logger.info(`实例 ${instanceId} RCON状态变更: ${status}`)
    })
    
    rconManager.on('error', (error: Error) => {
      logger.error(`实例 ${instanceId} RCON错误:`, error)
    })
    
    rconManager.on('disconnect', () => {
      logger.info(`实例 ${instanceId} RCON连接断开`)
      rconConnections.delete(instanceId)
    })
    
    try {
      await rconManager.connect(config)
      rconConnections.set(instanceId, rconManager)
      
      res.json({
        success: true,
        message: 'RCON连接成功',
        status: rconManager.getStatus()
      })
    } catch (connectError: any) {
      // 详细的连接错误处理
      let errorMessage = 'RCON连接失败'
      
      if (connectError.code === 'ECONNREFUSED') {
        errorMessage = `连接被拒绝：无法连接到 ${config.host}:${config.port}，请检查服务器是否运行且RCON已启用`
      } else if (connectError.code === 'ETIMEDOUT') {
        errorMessage = `连接超时：无法在指定时间内连接到 ${config.host}:${config.port}，请检查网络连接和防火墙设置`
      } else if (connectError.code === 'ENOTFOUND') {
        errorMessage = `主机未找到：无法解析主机名 ${config.host}，请检查主机地址是否正确`
      } else if (connectError.code === 'ECONNRESET') {
        errorMessage = `连接被重置：服务器主动断开了连接，可能是RCON配置错误`
      } else if (connectError.message.includes('身份验证失败') || connectError.message.includes('密码错误')) {
        errorMessage = `身份验证失败：RCON密码错误，请检查密码是否正确`
      } else if (connectError.message.includes('身份验证超时')) {
        errorMessage = `身份验证超时：服务器响应缓慢，请稍后重试`
      } else if (connectError.message.includes('连接超时')) {
        errorMessage = `连接超时：无法在 ${config.timeout || 5000}ms 内建立连接`
      } else {
        errorMessage = `连接失败：${connectError.message || '未知错误'}`
      }
      
      logger.error(`实例 ${instanceId} RCON连接失败:`, connectError)
      
      res.status(500).json({
        success: false,
        error: 'RCON连接失败',
        message: errorMessage,
        details: {
          host: config.host,
          port: config.port,
          errorCode: connectError.code,
          originalError: connectError.message
        }
      })
    }
  } catch (error: any) {
    logger.error('RCON连接处理失败:', error)
    res.status(500).json({
      success: false,
      error: 'RCON连接处理失败',
      message: error.message || '服务器内部错误'
    })
  }
})

// 断开RCON连接
router.post('/:instanceId/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const rconManager = rconConnections.get(instanceId)
    
    if (rconManager) {
      rconManager.disconnect()
      rconConnections.delete(instanceId)
    }
    
    res.json({
      success: true,
      message: 'RCON连接已断开'
    })
  } catch (error: any) {
    logger.error('断开RCON连接失败:', error)
    res.status(500).json({
      success: false,
      error: '断开RCON连接失败',
      message: error.message
    })
  }
})

// 获取RCON连接状态
router.get('/:instanceId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const rconManager = rconConnections.get(instanceId)
    
    if (!rconManager) {
      return res.json({
        success: true,
        data: {
          status: RconStatus.DISCONNECTED,
          connected: false
        }
      })
    }
    
    res.json({
      success: true,
      data: {
        status: rconManager.getStatus(),
        connected: rconManager.isConnected(),
        config: rconManager.getConfig()
      }
    })
  } catch (error: any) {
    logger.error('获取RCON状态失败:', error)
    res.status(500).json({
      success: false,
      error: '获取RCON状态失败',
      message: error.message
    })
  }
})

// 执行RCON命令
router.post('/:instanceId/command', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params
    const { command } = req.body
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: '缺少命令参数'
      })
    }
    
    const rconManager = rconConnections.get(instanceId)
    
    if (!rconManager || !rconManager.isConnected()) {
      return res.status(400).json({
        success: false,
        error: 'RCON未连接'
      })
    }
    
    const response = await rconManager.executeCommand(command)
    
    res.json({
      success: true,
      data: {
        command,
        response,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error: any) {
    logger.error('执行RCON命令失败:', error)
    res.status(500).json({
      success: false,
      error: '执行RCON命令失败',
      message: error.message
    })
  }
})

// 清理所有RCON连接（服务器关闭时调用）
export const cleanupRconConnections = (): void => {
  for (const [instanceId, rconManager] of rconConnections) {
    logger.info(`清理实例 ${instanceId} 的RCON连接`)
    rconManager.disconnect()
  }
  rconConnections.clear()
}

export default router