import express from 'express'
import os from 'os'
import logger from '../utils/logger'
import { JavaManager, VcRedistManager } from '../modules/environment'
import { authenticateToken } from '../middleware/auth'

// 存储Socket.IO实例的变量
let io: any = null

// 设置Socket.IO实例的函数
export const setEnvironmentSocketIO = (socketIO: any) => {
  io = socketIO
}

const router = express.Router()
const javaManager = new JavaManager()
const vcRedistManager = new VcRedistManager()

// 获取系统信息
router.get('/system-info', authenticateToken, async (req, res) => {
  try {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      type: os.type(),
      release: os.release()
    }
    
    res.json({
      success: true,
      data: systemInfo
    })
  } catch (error) {
    logger.error('获取系统信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取系统信息失败'
    })
  }
})

// 获取Java环境列表
router.get('/java', authenticateToken, async (req, res) => {
  try {
    const environments = await javaManager.getJavaEnvironments()

    res.json({
      success: true,
      data: environments
    })
  } catch (error) {
    logger.error('获取Java环境列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取Java环境列表失败'
    })
  }
})

// 安装Java环境
router.post('/java/install', authenticateToken, async (req, res) => {
  const { version, downloadUrl, socketId } = req.body

  if (!version || !downloadUrl) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    })
  }

  try {
    // 立即返回响应，安装过程在后台进行
    res.json({
      success: true,
      message: `${version} 开始安装`
    })

    // 后台执行安装，通过WebSocket发送进度更新
    await javaManager.installJava(version, downloadUrl, (stage, progress) => {
      if (io && socketId) {
        io.to(socketId).emit('java-install-progress', {
          version,
          stage,
          progress
        })
      }
    })

    // 安装完成通知
    if (io && socketId) {
      io.to(socketId).emit('java-install-complete', {
        version,
        success: true,
        message: `${version} 安装成功`
      })
    }
  } catch (error) {
    logger.error(`安装 ${version} 失败:`, error)

    // 安装失败通知
    if (io && socketId) {
      io.to(socketId).emit('java-install-complete', {
        version,
        success: false,
        message: `${version} 安装失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }
})

// 卸载Java环境
router.delete('/java/:version', authenticateToken, async (req, res) => {
  const { version } = req.params

  try {
    await javaManager.uninstallJava(version)

    res.json({
      success: true,
      message: `${version} 卸载成功`
    })
  } catch (error) {
    logger.error(`卸载 ${version} 失败:`, error)

    const statusCode = error instanceof Error && error.message.includes('未安装') ? 404 : 500
    res.status(statusCode).json({
      success: false,
      message: `卸载 ${version} 失败: ${error instanceof Error ? error.message : '未知错误'}`
    })
  }
})

// 验证Java安装
router.get('/java/:version/verify', authenticateToken, async (req, res) => {
  const { version } = req.params

  try {
    const result = await javaManager.verifyJava(version)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error(`验证 ${version} 失败:`, error)

    const statusCode = error instanceof Error && error.message.includes('未安装') ? 404 : 500
    res.status(statusCode).json({
      success: false,
      message: `验证 ${version} 失败: ${error instanceof Error ? error.message : '未知错误'}`
    })
  }
})

// 获取Visual C++运行库环境列表
router.get('/vcredist', authenticateToken, async (req, res) => {
  try {
    const environments = await vcRedistManager.getVcRedistEnvironments()

    res.json({
      success: true,
      data: environments
    })
  } catch (error) {
    logger.error('获取Visual C++运行库环境列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取Visual C++运行库环境列表失败'
    })
  }
})

// 安装Visual C++运行库
router.post('/vcredist/install', authenticateToken, async (req, res) => {
  const { version, architecture, downloadUrl, socketId } = req.body

  if (!version || !architecture || !downloadUrl) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    })
  }

  try {
    // 立即返回响应，安装过程在后台进行
    res.json({
      success: true,
      message: `Visual C++ ${version} ${architecture} 开始安装`
    })

    // 后台执行安装，通过WebSocket发送进度更新
    await vcRedistManager.installVcRedist(
      version,
      architecture,
      downloadUrl,
      (stage, progress) => {
        if (io && socketId) {
          io.to(socketId).emit('vcredist-install-progress', {
            version,
            architecture,
            stage,
            progress
          })
        }
      }
    )

    // 安装完成通知
    if (io && socketId) {
      io.to(socketId).emit('vcredist-install-complete', {
        version,
        architecture,
        success: true,
        message: `Visual C++ ${version} ${architecture} 安装成功`
      })
    }
  } catch (error) {
    logger.error(`安装 Visual C++ ${version} ${architecture} 失败:`, error)

    // 安装失败通知
    if (io && socketId) {
      io.to(socketId).emit('vcredist-install-complete', {
        version,
        architecture,
        success: false,
        message: `Visual C++ ${version} ${architecture} 安装失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }
})

// 卸载Visual C++运行库
router.delete('/vcredist/:version/:architecture', authenticateToken, async (req, res) => {
  const { version, architecture } = req.params
  const { socketId } = req.body

  try {
    // 立即返回响应，卸载过程在后台进行
    res.json({
      success: true,
      message: `Visual C++ ${version} ${architecture} 卸载命令已下发`
    })

    // 后台执行卸载
    await vcRedistManager.uninstallVcRedist(version, architecture)

    // 卸载完成通知
    if (io && socketId) {
      io.to(socketId).emit('vcredist-uninstall-complete', {
        version,
        architecture,
        success: true,
        message: `Visual C++ ${version} ${architecture} 卸载成功`
      })
    }
  } catch (error) {
    logger.error(`卸载 Visual C++ ${version} ${architecture} 失败:`, error)

    // 卸载失败通知
    if (io && socketId) {
      io.to(socketId).emit('vcredist-uninstall-complete', {
        version,
        architecture,
        success: false,
        message: `Visual C++ ${version} ${architecture} 卸载失败: ${error instanceof Error ? error.message : '未知错误'}`
      })
    }
  }
})

// 验证Visual C++运行库安装
router.get('/vcredist/:version/:architecture/verify', authenticateToken, async (req, res) => {
  const { version, architecture } = req.params

  try {
    const result = await vcRedistManager.verifyVcRedist(version, architecture)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error(`验证 Visual C++ ${version} ${architecture} 失败:`, error)

    res.status(500).json({
      success: false,
      message: `验证 Visual C++ ${version} ${architecture} 失败: ${error instanceof Error ? error.message : '未知错误'}`
    })
  }
})

export default router
