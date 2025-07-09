import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { TerminalManager } from '../modules/terminal/TerminalManager.js'
import { InstanceManager } from '../modules/instance/InstanceManager.js'
import { SteamCMDManager } from '../modules/steamcmd/SteamCMDManager.js'
import { ConfigManager } from '../modules/config/ConfigManager.js'
import logger from '../utils/logger.js'
import { authenticateToken } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// 管理器实例
let terminalManager: TerminalManager
let instanceManager: InstanceManager
let steamcmdManager: SteamCMDManager
let configManager: ConfigManager

// 设置管理器实例
export function setGameDeploymentManagers(
  terminal: TerminalManager,
  instance: InstanceManager,
  steamcmd: SteamCMDManager,
  config: ConfigManager
) {
  terminalManager = terminal
  instanceManager = instance
  steamcmdManager = steamcmd
  configManager = config
}

// 获取可安装的游戏列表
router.get('/games', authenticateToken, async (req: Request, res: Response) => {
  try {
    const gamesFilePath = path.join(__dirname, '../../data/games/installgame.json')
    const gamesData = await fs.readFile(gamesFilePath, 'utf-8')
    const games = JSON.parse(gamesData)
    
    res.json({
      success: true,
      data: games
    })
  } catch (error: any) {
    logger.error('获取游戏列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取游戏列表失败',
      message: error.message
    })
  }
})

// 安装游戏
router.post('/install', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { 
      gameKey, 
      gameName, 
      appId, 
      installPath, 
      instanceName, 
      useAnonymous, 
      steamUsername, 
      steamPassword, 
      steamcmdCommand 
    } = req.body
    
    if (!gameKey || !installPath || !instanceName || !steamcmdCommand) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
        message: '游戏标识、安装路径、实例名称和SteamCMD命令为必填项'
      })
    }
    
    if (!useAnonymous && (!steamUsername || !steamPassword)) {
      return res.status(400).json({
        success: false,
        error: '缺少Steam账户信息',
        message: '非匿名模式下需要提供Steam用户名和密码'
      })
    }
    
    // 检查安装路径是否存在
    try {
      await fs.access(installPath)
    } catch {
      // 如果路径不存在，尝试创建
      try {
        await fs.mkdir(installPath, { recursive: true })
      } catch (mkdirError: any) {
        return res.status(400).json({
          success: false,
          error: '无法创建安装路径',
          message: mkdirError.message
        })
      }
    }
    
    logger.info(`开始安装游戏: ${gameName || gameKey}`, {
      installPath,
      appId,
      command: steamcmdCommand
    })
    
    try {
      // 获取SteamCMD路径
      const steamcmdPath = steamcmdManager.getSteamCMDExecutablePath()
      if (!steamcmdPath) {
        return res.status(400).json({
          success: false,
          error: 'SteamCMD未配置',
          message: '请先在设置中配置SteamCMD路径'
        })
      }
      
      // 获取SteamCMD所在目录作为工作目录
      const steamcmdDir = path.dirname(steamcmdPath)
      
      // 创建虚拟socket用于终端会话
      const virtualSocket = {
        id: `install-${Date.now()}`,
        emit: () => {},
        on: () => {},
        disconnect: () => {}
      } as any
      
      // 生成终端会话ID
      const terminalSessionId = `install-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 创建终端会话并执行安装命令
      terminalManager.createPty(virtualSocket, {
        sessionId: terminalSessionId,
        cols: 80,
        rows: 24,
        workingDirectory: steamcmdDir
      })
      
      // 等待终端完全初始化
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 根据操作系统构建SteamCMD执行命令
      const platform = os.platform()
      let steamcmdExecutable: string
      
      if (platform === 'win32') {
        steamcmdExecutable = '.\\steamcmd.exe'
      } else {
        steamcmdExecutable = './steamcmd.sh'
      }
      
      // 构建完整的执行命令
      const fullCommand = `${steamcmdExecutable} ${steamcmdCommand}`
      
      logger.info(`执行SteamCMD命令: ${fullCommand}`, {
        platform,
        workingDirectory: steamcmdDir
      })
      
      // 发送安装命令到终端
      terminalManager.handleInput(virtualSocket, {
        sessionId: terminalSessionId,
        data: fullCommand + '\r'
      })
      
      // 创建实例（在安装开始时就创建，而不是等安装完成）
      const instanceData = {
        name: instanceName,
        description: `${gameName || gameKey} 服务器实例`,
        workingDirectory: installPath,
        startCommand: 'none',
        autoStart: false,
        stopCommand: 'ctrl+c' as 'ctrl+c' | 'stop' | 'exit'
      }
      
      const instance = await instanceManager.createInstance(instanceData)
      
      logger.info(`游戏安装已开始: ${gameName || gameKey}`, {
        terminalSessionId,
        instanceId: instance.id,
        installPath
      })
      
      // 返回成功响应和终端会话ID
      res.json({
        success: true,
        message: `${gameName || gameKey} 安装已开始`,
        data: {
          terminalSessionId,
          instance,
          installPath
        }
      })
      
    } catch (error: any) {
      logger.error('创建游戏安装会话失败:', error)
      res.status(500).json({
        success: false,
        error: '创建安装会话失败',
        message: error.message
      })
    }
    
  } catch (error: any) {
    logger.error('游戏安装请求处理失败:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: '游戏安装请求处理失败',
        message: error.message
      })
    }
  }
})

export default router