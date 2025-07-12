import { Router } from 'express'
import terminalRoutes from './terminal.js'
import gameRoutes from './games.js'
import systemRoutes from './system.js'
import fileRoutes from './files.js'
import instanceRoutes from './instances.js'
import { minecraftRouter } from './minecraft.js'

const router = Router()

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// API版本信息
router.get('/version', (req, res) => {
  res.json({
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  })
})

// 注册子路由
router.use('/terminal', terminalRoutes)
router.use('/games', gameRoutes)
router.use('/system', systemRoutes)
router.use('/files', fileRoutes)
router.use('/instances', instanceRoutes)
router.use('/minecraft', minecraftRouter)

export default router