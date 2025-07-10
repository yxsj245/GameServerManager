import { Router, Request, Response } from 'express'
import { MinecraftServerDownloader, getServerCategories, getAvailableVersions, getDownloadInfo, validateJavaEnvironment } from '../modules/game/minecraft-server-api.js'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import path from 'path'
import { Server as SocketIOServer } from 'socket.io'
import { InstanceManager } from '../modules/instance/InstanceManager.js'

const router = Router()
let io: SocketIOServer
let instanceManager: InstanceManager

// 全局下载器管理器
const activeDownloads = new Map<string, MinecraftServerDownloader>()

// 设置Socket.IO和InstanceManager
export function setMinecraftDependencies(socketIO: SocketIOServer, instManager: InstanceManager) {
  io = socketIO
  instanceManager = instManager
}

// 应用认证中间件
router.use(authenticateToken)

// 获取服务器分类
router.get('/server-categories', async (req: Request, res: Response) => {
  try {
    logger.info('获取Minecraft服务器分类')
    const categories = await getServerCategories()
    
    res.json({
      success: true,
      data: categories,
      message: '获取服务器分类成功'
    })
  } catch (error: any) {
    logger.error('获取服务器分类失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取服务器分类失败'
    })
  }
})

// 取消Minecraft服务端下载
router.post('/cancel-download', async (req: Request, res: Response) => {
  try {
    const { downloadId } = req.body
    
    if (!downloadId) {
      return res.status(400).json({
        success: false,
        message: '缺少下载ID参数'
      })
    }
    
    // 查找活跃的下载任务
    const downloader = activeDownloads.get(downloadId)
    
    if (!downloader) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的下载任务'
      })
    }
    
    // 取消下载
    downloader.cancel()
    
    // 从活跃下载列表中移除
    activeDownloads.delete(downloadId)
    
    logger.info(`下载任务已取消: ${downloadId}`)
    
    res.json({
      success: true,
      message: '下载已取消'
    })
    
  } catch (error: any) {
    logger.error('取消下载失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '取消下载失败'
    })
  }
})

// 获取指定服务端的可用版本
router.get('/versions/:server', async (req: Request, res: Response) => {
  try {
    const { server } = req.params
    
    if (!server) {
      return res.status(400).json({
        success: false,
        message: '缺少服务端参数'
      })
    }
    
    logger.info(`获取服务端 ${server} 的可用版本`)
    const versions = await getAvailableVersions(server)
    
    res.json({
      success: true,
      data: versions,
      message: '获取版本列表成功'
    })
  } catch (error: any) {
    logger.error('获取版本列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取版本列表失败'
    })
  }
})

// 获取下载信息
router.get('/download-info/:server/:version', async (req: Request, res: Response) => {
  try {
    const { server, version } = req.params
    
    if (!server || !version) {
      return res.status(400).json({
        success: false,
        message: '缺少服务端或版本参数'
      })
    }
    
    logger.info(`获取 ${server} ${version} 的下载信息`)
    const downloadInfo = await getDownloadInfo(server, version)
    
    res.json({
      success: true,
      data: downloadInfo,
      message: '获取下载信息成功'
    })
  } catch (error: any) {
    logger.error('获取下载信息失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取下载信息失败'
    })
  }
})

// 验证Java环境
router.get('/validate-java', async (req: Request, res: Response) => {
  try {
    logger.info('验证Java环境')
    const isValid = await validateJavaEnvironment()
    
    res.json({
      success: isValid,
      data: { javaValid: isValid },
      message: isValid ? 'Java环境正常' : 'Java环境未找到'
    })
  } catch (error: any) {
    logger.error('Java环境验证失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Java环境验证失败'
    })
  }
})

// 下载Minecraft服务端
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { server, version, targetDirectory, skipJavaCheck = false, skipServerRun = false, socketId } = req.body
    
    if (!server || !version || !targetDirectory) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：server, version, targetDirectory'
      })
    }
    
    // 确保目标目录是绝对路径
    const absoluteTargetDir = path.isAbsolute(targetDirectory) 
      ? targetDirectory 
      : path.resolve(process.cwd(), 'server', 'data', 'minecraft-servers', targetDirectory)
    
    const downloadId = `minecraft-download-${Date.now()}`
    
    // 立即返回下载ID
    res.json({
      success: true,
      data: {
        downloadId
      },
      message: '开始下载Minecraft服务端'
    })
    
    logger.info(`开始下载Minecraft服务端: ${server} ${version} 到 ${absoluteTargetDir}`)
    
    // 异步执行下载
    ;(async () => {
      try {
        // 创建下载器实例
        const downloader = new MinecraftServerDownloader(
          // 进度回调
          (progress) => {
            if (io && socketId) {
              io.to(socketId).emit('minecraft-download-progress', {
                downloadId,
                progress,
                message: `下载进度: ${progress.percentage}% (${progress.loaded}/${progress.total})`
              })
            }
            logger.info(`下载进度: ${progress.percentage}% (${progress.loaded}/${progress.total})`)
          },
          // 日志回调
          (message, type = 'info') => {
            if (io && socketId) {
              io.to(socketId).emit('minecraft-download-log', {
                downloadId,
                message: `[${type.toUpperCase()}] ${message}`
              })
            }
            logger.info(`[${type.toUpperCase()}] ${message}`)
          },
          // 下载ID
          downloadId
        )
        
        // 将下载器添加到活跃下载列表
        activeDownloads.set(downloadId, downloader)
        
        // 执行下载
        await downloader.downloadServer({
          server,
          version,
          targetDirectory: absoluteTargetDir,
          skipJavaCheck,
          skipServerRun
        })
        
        logger.info(`Minecraft服务端下载完成: ${server} ${version}`)
        
        // 从活跃下载列表中移除
        activeDownloads.delete(downloadId)
        
        // 下载完成，发送完成事件
        if (io && socketId) {
          io.to(socketId).emit('minecraft-download-complete', {
            downloadId,
            success: true,
            data: {
              server,
              version,
              targetDirectory: absoluteTargetDir
            },
            message: `${server} ${version} 下载完成！可以创建实例了`
          })
        }
        
      } catch (error: any) {
        logger.error('Minecraft服务端下载失败:', error)
        
        // 从活跃下载列表中移除
        activeDownloads.delete(downloadId)
        
        // 发送错误事件
        if (io && socketId) {
          io.to(socketId).emit('minecraft-download-error', {
            downloadId,
            success: false,
            error: error.message || 'Minecraft服务端下载失败'
          })
        }
      }
    })()
    
  } catch (error: any) {
    logger.error('启动Minecraft服务端下载失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '启动Minecraft服务端下载失败'
    })
  }
})

// 创建Minecraft实例
router.post('/create-instance', async (req: Request, res: Response) => {
  try {
    const { name, description, workingDirectory, version, serverType } = req.body
    
    if (!name || !workingDirectory) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: name, workingDirectory'
      })
    }

    if (!instanceManager) {
      return res.status(500).json({
        success: false,
        error: 'InstanceManager未初始化'
      })
    }

    // 根据服务端类型确定启动命令
    let startCommand = 'java -Xmx2G -Xms1G -jar server.jar nogui'
    
    // 根据不同的服务端类型调整启动命令
    if (serverType) {
      switch (serverType.toLowerCase()) {
        case 'paper':
        case 'spigot':
        case 'bukkit':
          startCommand = 'java -Xmx2G -Xms1G -jar server.jar nogui'
          break
        case 'forge':
          startCommand = 'java -Xmx2G -Xms1G -jar forge-*.jar nogui'
          break
        case 'fabric':
          startCommand = 'java -Xmx2G -Xms1G -jar fabric-server-launch.jar nogui'
          break
        case 'vanilla':
        default:
          startCommand = 'java -Xmx2G -Xms1G -jar server.jar nogui'
          break
      }
    }

    const instanceData = {
      name,
      description: description || `Minecraft ${serverType || 'Server'} ${version || ''}`,
      workingDirectory,
      startCommand,
      autoStart: false,
      stopCommand: 'stop' as const
    }

    const instance = await instanceManager.createInstance(instanceData)
    
    logger.info(`创建Minecraft实例成功: ${instance.name} (${instance.id})`)
    
    res.json({
      success: true,
      data: instance,
      message: `Minecraft实例 "${instance.name}" 创建成功！`
    })
  } catch (error: any) {
    logger.error('创建Minecraft实例失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建Minecraft实例失败'
    })
  }
})

export default router