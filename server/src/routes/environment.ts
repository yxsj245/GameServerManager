import express from 'express'
import os from 'os'
import logger from '../utils/logger'
import { JavaManager } from '../modules/environment'
import { authenticateToken } from '../middleware/auth'

// 存储Socket.IO实例的变量
let io: any = null

// 设置Socket.IO实例的函数
export const setEnvironmentSocketIO = (socketIO: any) => {
  io = socketIO
}

const router = express.Router()
const javaManager = new JavaManager()

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

export default router
