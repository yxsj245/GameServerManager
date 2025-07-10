import { Router, Request, Response } from 'express'
import { MinecraftServerDownloader, getServerCategories, getAvailableVersions, getDownloadInfo, validateJavaEnvironment } from '../modules/game/minecraft-server-api.js'
import { authenticateToken } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import path from 'path'

const router = Router()

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
    const { server, version, targetDirectory, skipJavaCheck = false, skipServerRun = false } = req.body
    
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
    
    logger.info(`开始下载Minecraft服务端: ${server} ${version} 到 ${absoluteTargetDir}`)
    
    // 创建下载器实例
    const downloader = new MinecraftServerDownloader(
      // 进度回调
      (progress) => {
        logger.info(`下载进度: ${progress.percentage}% (${progress.loaded}/${progress.total})`)
        // 这里可以通过WebSocket发送进度更新
      },
      // 日志回调
      (message, type = 'info') => {
        logger.info(`[${type.toUpperCase()}] ${message}`)
      }
    )
    
    // 执行下载
    await downloader.downloadServer({
      server,
      version,
      targetDirectory: absoluteTargetDir,
      skipJavaCheck,
      skipServerRun
    })
    
    logger.info(`Minecraft服务端下载完成: ${server} ${version}`)
    
    res.json({
      success: true,
      data: {
        server,
        version,
        targetDirectory: absoluteTargetDir
      },
      message: `${server} ${version} 下载完成！`
    })
    
  } catch (error: any) {
    logger.error('Minecraft服务端下载失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Minecraft服务端下载失败'
    })
  }
})

export default router