import express from 'express'
import path from 'path'
import { promises as fs } from 'fs'
import { authenticateToken } from '../middleware/auth.js'
import type { PluginManager } from '../modules/plugin/PluginManager.js'

const router = express.Router()

let pluginManager: PluginManager

export function setPluginManager(manager: PluginManager) {
  pluginManager = manager
}

// 获取所有插件列表
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const plugins = pluginManager.getPlugins()
    res.json({
      success: true,
      data: plugins
    })
  } catch (error) {
    console.error('获取插件列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取插件列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 获取单个插件信息
router.get('/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const plugin = pluginManager.getPlugin(name)
    
    if (!plugin) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    res.json({
      success: true,
      data: plugin
    })
  } catch (error) {
    console.error('获取插件信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取插件信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 启用插件
router.post('/:name/enable', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const success = await pluginManager.enablePlugin(name)
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    res.json({
      success: true,
      message: '插件已启用'
    })
  } catch (error) {
    console.error('启用插件失败:', error)
    res.status(500).json({
      success: false,
      message: '启用插件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 禁用插件
router.post('/:name/disable', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const success = await pluginManager.disablePlugin(name)
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    res.json({
      success: true,
      message: '插件已禁用'
    })
  } catch (error) {
    console.error('禁用插件失败:', error)
    res.status(500).json({
      success: false,
      message: '禁用插件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 创建新插件
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { name, displayName, description, version, author, category, icon } = req.body
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '插件名称不能为空'
      })
    }

    // 验证插件名称格式（只允许字母、数字、下划线、连字符）
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({
        success: false,
        message: '插件名称只能包含字母、数字、下划线和连字符'
      })
    }

    const success = await pluginManager.createPlugin(name, {
      displayName,
      description,
      version,
      author,
      category,
      icon
    })
    
    if (!success) {
      return res.status(400).json({
        success: false,
        message: '插件已存在或创建失败'
      })
    }

    res.json({
      success: true,
      message: '插件创建成功'
    })
  } catch (error) {
    console.error('创建插件失败:', error)
    res.status(500).json({
      success: false,
      message: '创建插件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 删除插件
router.delete('/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const success = await pluginManager.deletePlugin(name)
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    res.json({
      success: true,
      message: '插件删除成功'
    })
  } catch (error) {
    console.error('删除插件失败:', error)
    res.status(500).json({
      success: false,
      message: '删除插件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 获取插件文件内容
router.get('/:name/files/*', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const filePath = req.params[0] || 'index.html'
    
    const plugin = pluginManager.getPlugin(name)
    if (!plugin) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    const pluginPath = pluginManager.getPluginPath(name)
    const fullPath = path.join(pluginPath, filePath)
    
    // 安全检查：确保文件路径在插件目录内
    const normalizedPluginPath = path.normalize(pluginPath)
    const normalizedFullPath = path.normalize(fullPath)
    if (!normalizedFullPath.startsWith(normalizedPluginPath)) {
      return res.status(403).json({
        success: false,
        message: '访问被拒绝'
      })
    }

    try {
      const stats = await fs.stat(fullPath)
      if (!stats.isFile()) {
        return res.status(404).json({
          success: false,
          message: '文件不存在'
        })
      }

      // 根据文件扩展名设置Content-Type
      const ext = path.extname(filePath).toLowerCase()
      const contentTypes: { [key: string]: string } = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      }

      // 对于HTML、CSS、JS等文本文件，返回JSON格式的内容
      if (['.html', '.css', '.js', '.json'].includes(ext)) {
        const fileContent = await fs.readFile(fullPath, 'utf-8')
        res.json({
          success: true,
          data: fileContent
        })
      } else {
        // 对于图片等二进制文件，直接返回文件内容
        const contentType = contentTypes[ext] || 'application/octet-stream'
        res.setHeader('Content-Type', contentType)
        const fileContent = await fs.readFile(fullPath)
        res.send(fileContent)
      }
    } catch (fileError) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      })
    }
  } catch (error) {
    console.error('获取插件文件失败:', error)
    res.status(500).json({
      success: false,
      message: '获取插件文件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

// 更新插件文件内容
router.put('/:name/files/*', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params
    const filePath = req.params[0]
    const { content } = req.body
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '文件路径不能为空'
      })
    }

    const plugin = pluginManager.getPlugin(name)
    if (!plugin) {
      return res.status(404).json({
        success: false,
        message: '插件不存在'
      })
    }

    const pluginPath = pluginManager.getPluginPath(name)
    const fullPath = path.join(pluginPath, filePath)
    
    // 安全检查：确保文件路径在插件目录内
    const normalizedPluginPath = path.normalize(pluginPath)
    const normalizedFullPath = path.normalize(fullPath)
    if (!normalizedFullPath.startsWith(normalizedPluginPath)) {
      return res.status(403).json({
        success: false,
        message: '访问被拒绝'
      })
    }

    // 确保目录存在
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    
    // 写入文件
    await fs.writeFile(fullPath, content, 'utf-8')

    res.json({
      success: true,
      message: '文件保存成功'
    })
  } catch (error) {
    console.error('保存插件文件失败:', error)
    res.status(500).json({
      success: false,
      message: '保存插件文件失败',
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

export default router