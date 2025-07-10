import { Router, Request, Response } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { TModDownloader } from '../modules/game/tmodloader-server-api.js'
import { FactorioDeployer } from '../modules/game/factorio-deployer.js'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import { Server as SocketIOServer } from 'socket.io'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()
let io: SocketIOServer

// 全局部署任务管理器
const activeDeployments = new Map<string, any>()

// 设置Socket.IO依赖
export function setMoreGamesDependencies(socketIO: SocketIOServer) {
  io = socketIO
}

// 游戏类型枚举
export enum GameType {
  TMODLOADER = 'tmodloader',
  FACTORIO = 'factorio'
}

// 平台类型枚举
export enum Platform {
  WINDOWS = 'windows',
  LINUX = 'linux',
  MACOS = 'macos'
}

// 游戏信息接口
export interface GameInfo {
  id: string
  name: string
  description: string
  icon: string
  category: string
  supported: boolean
  supportedPlatforms: Platform[]
}

// 部署选项接口
export interface DeploymentOptions {
  gameType: GameType
  installPath: string
  options?: any
}

// 部署结果接口
export interface DeploymentResult {
  success: boolean
  message: string
  data?: any
}

// 获取当前平台
function getCurrentPlatform(): Platform {
  const platform = process.platform
  switch (platform) {
    case 'win32':
      return Platform.WINDOWS
    case 'linux':
      return Platform.LINUX
    case 'darwin':
      return Platform.MACOS
    default:
      return Platform.LINUX // 默认为Linux
  }
}

// 检查游戏是否支持当前平台
function isGameSupportedOnCurrentPlatform(game: GameInfo): boolean {
  const currentPlatform = getCurrentPlatform()
  return game.supportedPlatforms.includes(currentPlatform)
}

// 支持的游戏列表
const supportedGames: GameInfo[] = [
  {
    id: 'tmodloader',
    name: 'tModLoader',
    description: 'Terraria模组加载器服务端',
    icon: '🎮',
    category: '沙盒游戏',
    supported: true,
    supportedPlatforms: [Platform.WINDOWS, Platform.LINUX, Platform.MACOS] // 全平台支持
  },
  {
    id: 'factorio',
    name: 'Factorio',
    description: 'Factorio工厂建造游戏服务端',
    icon: '🏭',
    category: '策略游戏',
    supported: true,
    supportedPlatforms: [Platform.LINUX] // 仅Linux平台支持
  }
]

// 获取支持的游戏列表
router.get('/games', authenticateToken, async (req: Request, res: Response) => {
  try {
    const currentPlatform = getCurrentPlatform()
    
    // 过滤出当前平台支持的游戏，并添加平台信息
    const filteredGames = supportedGames.map(game => ({
      ...game,
      currentPlatform,
      supportedOnCurrentPlatform: isGameSupportedOnCurrentPlatform(game)
    }))
    
    res.json({
      success: true,
      data: filteredGames,
      meta: {
        currentPlatform,
        totalGames: supportedGames.length,
        supportedGames: filteredGames.filter(g => g.supportedOnCurrentPlatform).length
      }
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

// 获取游戏详细信息
router.get('/games/:gameId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    const game = supportedGames.find(g => g.id === gameId)
    
    if (!game) {
      return res.status(404).json({
        success: false,
        error: '游戏不存在',
        message: `未找到游戏: ${gameId}`
      })
    }
    
    res.json({
      success: true,
      data: game
    })
  } catch (error: any) {
    logger.error('获取游戏信息失败:', error)
    res.status(500).json({
      success: false,
      error: '获取游戏信息失败',
      message: error.message
    })
  }
})

// 部署tModLoader服务端
router.post('/deploy/tmodloader', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { installPath, options = {}, socketId } = req.body
    
    if (!installPath) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
        message: '安装路径为必填项'
      })
    }
    
    const deploymentId = `tmodloader-deploy-${Date.now()}`
    
    // 立即返回部署ID
    res.json({
      success: true,
      data: {
        deploymentId
      },
      message: '开始部署tModLoader服务端'
    })
    
    logger.info('开始部署tModLoader服务端', { installPath, options, deploymentId })
    
    // 异步执行部署
    ;(async () => {
      try {
        // 发送开始部署事件
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '开始部署tModLoader服务端...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 10 },
            message: '初始化部署环境...'
          })
        }
        
        // 创建tModLoader下载器实例
        const downloader = new TModDownloader({
          downloadDir: path.dirname(installPath),
          extractDir: installPath,
          deleteAfterExtract: options.deleteAfterExtract ?? true,
          clearExtractDir: options.clearExtractDir ?? false,
          createVersionDir: options.createVersionDir ?? false
        })
        
        // 将部署任务添加到活跃列表
        activeDeployments.set(deploymentId, { type: 'tmodloader', downloader })
        
        // 发送下载开始日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '正在下载tModLoader服务端...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 30 },
            message: '正在下载tModLoader...'
          })
        }
        
        // 执行下载和解压
        await downloader.downloadAndExtract()
        
        // 发送解压进度日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '下载完成，正在解压文件...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 70 },
            message: '正在解压文件...'
          })
        }
        
        // 获取版本信息
        const versionInfo = await downloader.getVersionInfo()
        
        // 发送版本检测日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: `检测到tModLoader版本: ${versionInfo.version || '未知'}`
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 95 },
            message: '正在完成部署...'
          })
        }
        
        // 从活跃部署列表中移除
        activeDeployments.delete(deploymentId)
        
        logger.info('tModLoader服务端部署成功', {
          installPath,
          version: versionInfo.version
        })
        
        // 发送最终完成日志和进度
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: 'tModLoader服务端部署成功！'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 100 },
            message: '部署完成'
          })
          io.to(socketId).emit('more-games-deploy-complete', {
            deploymentId,
            success: true,
            data: {
              installPath,
              version: versionInfo.version,
              downloadUrl: versionInfo.downloadUrl
            },
            message: 'tModLoader服务端部署成功！'
          })
        }
        
      } catch (error: any) {
        logger.error('tModLoader部署失败:', error)
        
        // 从活跃部署列表中移除
        activeDeployments.delete(deploymentId)
        
        // 发送错误事件
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-error', {
            deploymentId,
            success: false,
            error: error.message || 'tModLoader部署失败'
          })
        }
      }
    })()
    
  } catch (error: any) {
    logger.error('启动tModLoader部署失败:', error)
    res.status(500).json({
      success: false,
      error: 'tModLoader部署失败',
      message: error.message
    })
  }
})

// 部署Factorio服务端
router.post('/deploy/factorio', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { installPath, options = {}, socketId } = req.body
    
    if (!installPath) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
        message: '安装路径为必填项'
      })
    }
    
    const deploymentId = `factorio-deploy-${Date.now()}`
    
    // 立即返回部署ID
    res.json({
      success: true,
      data: {
        deploymentId
      },
      message: '开始部署Factorio服务端'
    })
    
    logger.info('开始部署Factorio服务端', { installPath, options, deploymentId })
    
    // 异步执行部署
    ;(async () => {
      try {
        // 发送开始部署事件
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '开始部署Factorio服务端...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 10 },
            message: '初始化部署环境...'
          })
        }
        
        // 创建Factorio部署器实例
        const deployer = new FactorioDeployer()
        
        // 将部署任务添加到活跃列表
        activeDeployments.set(deploymentId, { type: 'factorio', deployer })
        
        // 发送下载开始日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '正在下载Factorio服务端...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 30 },
            message: '正在下载Factorio...'
          })
        }
        
        // 执行部署
        const result = await deployer.deploy({
          extractPath: installPath,
          tempDir: options.tempDir
        })
        
        if (!result.success) {
          throw new Error(result.message || 'Factorio部署失败')
        }
        
        // 发送解压完成日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: '文件解压完成，正在配置服务端...'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 80 },
            message: '正在配置服务端...'
          })
        }
        
        // 获取版本信息
        const version = await deployer.getServerVersion(installPath)
        
        // 发送版本检测日志
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: `检测到Factorio版本: ${version || '未知'}`
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 95 },
            message: '正在完成部署...'
          })
        }
        
        // 从活跃部署列表中移除
        activeDeployments.delete(deploymentId)
        
        logger.info('Factorio服务端部署成功', {
          installPath,
          version,
          serverExecutablePath: result.serverExecutablePath
        })
        
        // 发送最终完成日志和进度
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-log', {
            deploymentId,
            message: 'Factorio服务端部署成功！'
          })
          io.to(socketId).emit('more-games-deploy-progress', {
            deploymentId,
            progress: { percentage: 100 },
            message: '部署完成'
          })
          io.to(socketId).emit('more-games-deploy-complete', {
            deploymentId,
            success: true,
            data: {
              installPath: result.extractPath,
              version,
              serverExecutablePath: result.serverExecutablePath
            },
            message: 'Factorio服务端部署成功！'
          })
        }
        
      } catch (error: any) {
        logger.error('Factorio部署失败:', error)
        
        // 从活跃部署列表中移除
        activeDeployments.delete(deploymentId)
        
        // 发送错误事件
        if (io && socketId) {
          io.to(socketId).emit('more-games-deploy-error', {
            deploymentId,
            success: false,
            error: error.message || 'Factorio部署失败'
          })
        }
      }
    })()
    
  } catch (error: any) {
    logger.error('启动Factorio部署失败:', error)
    res.status(500).json({
      success: false,
      error: 'Factorio部署失败',
      message: error.message
    })
  }
})

// 检查游戏部署状态
router.get('/status/:gameId/:installPath(*)', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId, installPath } = req.params
    
    if (!installPath) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
        message: '安装路径为必填项'
      })
    }
    
    let isDeployed = false
    let version: string | null = null
    
    switch (gameId) {
      case 'tmodloader': {
        // 检查tModLoader部署状态
        const tmodloaderPath = path.join(installPath, 'tModLoaderServer.exe')
        try {
          await fs.access(tmodloaderPath)
          isDeployed = true
          // 这里可以添加版本检测逻辑
        } catch {
          isDeployed = false
        }
        break
      }
      case 'factorio': {
        // 检查Factorio部署状态
        const deployer = new FactorioDeployer()
        isDeployed = await deployer.checkDeployment(installPath)
        if (isDeployed) {
          version = await deployer.getServerVersion(installPath)
        }
        break
      }
      default:
        return res.status(400).json({
          success: false,
          error: '不支持的游戏类型',
          message: `不支持的游戏: ${gameId}`
        })
    }
    
    res.json({
      success: true,
      data: {
        gameId,
        installPath,
        isDeployed,
        version
      }
    })
    
  } catch (error: any) {
    logger.error('检查部署状态失败:', error)
    res.status(500).json({
      success: false,
      error: '检查部署状态失败',
      message: error.message
    })
  }
})

// 获取游戏版本信息
router.get('/version/:gameId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    
    let versionInfo: any = null
    
    switch (gameId) {
      case 'tmodloader': {
        const downloader = new TModDownloader()
        versionInfo = await downloader.getVersionInfo()
        break
      }
      case 'factorio': {
        // Factorio版本信息需要从其他来源获取
        versionInfo = {
          version: 'latest',
          downloadUrl: 'https://factorio.com/get-download/stable/headless/linux64'
        }
        break
      }
      default:
        return res.status(400).json({
          success: false,
          error: '不支持的游戏类型',
          message: `不支持的游戏: ${gameId}`
        })
    }
    
    res.json({
      success: true,
      data: versionInfo
    })
    
  } catch (error: any) {
    logger.error('获取版本信息失败:', error)
    res.status(500).json({
      success: false,
      error: '获取版本信息失败',
      message: error.message
    })
  }
})

export default router