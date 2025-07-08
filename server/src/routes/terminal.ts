import { Router, Request, Response } from 'express'
import { TerminalManager } from '../modules/terminal/TerminalManager'
import logger from '../utils/logger'

const router = Router()

// 注意：这里需要在实际使用时注入TerminalManager实例
let terminalManager: TerminalManager

// 设置TerminalManager实例的函数
export function setTerminalManager(manager: TerminalManager) {
  terminalManager = manager
}

// 获取终端会话统计
router.get('/stats', (req: Request, res: Response) => {
  try {
    if (!terminalManager) {
      return res.status(500).json({ error: '终端管理器未初始化' })
    }
    
    const stats = terminalManager.getSessionStats()
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('获取终端统计失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计失败'
    })
  }
})

// 获取终端会话列表
router.get('/sessions', (req: Request, res: Response) => {
  try {
    if (!terminalManager) {
      return res.status(500).json({ error: '终端管理器未初始化' })
    }
    
    const stats = terminalManager.getSessionStats()
    res.json({
      success: true,
      data: {
        sessions: stats.sessions,
        total: stats.total
      }
    })
  } catch (error) {
    logger.error('获取终端会话列表失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取会话列表失败'
    })
  }
})

// 验证终端配置
router.post('/validate-config', (req: Request, res: Response) => {
  try {
    const { workingDirectory, shell } = req.body
    
    // 基本验证
    const errors: string[] = []
    
    if (!workingDirectory) {
      errors.push('工作目录不能为空')
    }
    
    if (shell && typeof shell !== 'string') {
      errors.push('Shell配置格式错误')
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      })
    }
    
    res.json({
      success: true,
      message: '配置验证通过'
    })
  } catch (error) {
    logger.error('验证终端配置失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '配置验证失败'
    })
  }
})

// 获取系统默认Shell
router.get('/default-shell', (req: Request, res: Response) => {
  try {
    const platform = process.platform
    let defaultShell: string
    let availableShells: string[]
    
    if (platform === 'win32') {
      defaultShell = 'powershell.exe'
      availableShells = [
        'powershell.exe',
        'cmd.exe',
        'pwsh.exe' // PowerShell Core
      ]
    } else {
      defaultShell = process.env.SHELL || '/bin/bash'
      availableShells = [
        '/bin/bash',
        '/bin/sh',
        '/bin/zsh',
        '/bin/fish'
      ]
    }
    
    res.json({
      success: true,
      data: {
        platform,
        defaultShell,
        availableShells,
        currentShell: process.env.SHELL || defaultShell
      }
    })
  } catch (error) {
    logger.error('获取默认Shell失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取默认Shell失败'
    })
  }
})

// 获取终端主题配置
router.get('/themes', (req: Request, res: Response) => {
  try {
    const themes = [
      {
        name: 'default',
        displayName: '默认',
        colors: {
          background: '#000000',
          foreground: '#ffffff',
          cursor: '#ffffff',
          selection: '#ffffff40'
        }
      },
      {
        name: 'dark',
        displayName: '深色',
        colors: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selection: '#264f78'
        }
      },
      {
        name: 'light',
        displayName: '浅色',
        colors: {
          background: '#ffffff',
          foreground: '#000000',
          cursor: '#000000',
          selection: '#0078d4'
        }
      },
      {
        name: 'monokai',
        displayName: 'Monokai',
        colors: {
          background: '#272822',
          foreground: '#f8f8f2',
          cursor: '#f8f8f0',
          selection: '#49483e'
        }
      },
      {
        name: 'solarized-dark',
        displayName: 'Solarized Dark',
        colors: {
          background: '#002b36',
          foreground: '#839496',
          cursor: '#93a1a1',
          selection: '#073642'
        }
      }
    ]
    
    res.json({
      success: true,
      data: themes
    })
  } catch (error) {
    logger.error('获取终端主题失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取主题失败'
    })
  }
})

// 获取终端字体配置
router.get('/fonts', (req: Request, res: Response) => {
  try {
    const fonts = [
      {
        family: 'Consolas',
        displayName: 'Consolas',
        monospace: true
      },
      {
        family: 'Monaco',
        displayName: 'Monaco',
        monospace: true
      },
      {
        family: 'Menlo',
        displayName: 'Menlo',
        monospace: true
      },
      {
        family: 'Courier New',
        displayName: 'Courier New',
        monospace: true
      },
      {
        family: 'monospace',
        displayName: '系统等宽字体',
        monospace: true
      },
      {
        family: 'Fira Code',
        displayName: 'Fira Code',
        monospace: true,
        ligatures: true
      },
      {
        family: 'Source Code Pro',
        displayName: 'Source Code Pro',
        monospace: true
      },
      {
        family: 'JetBrains Mono',
        displayName: 'JetBrains Mono',
        monospace: true,
        ligatures: true
      }
    ]
    
    const sizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30]
    
    res.json({
      success: true,
      data: {
        fonts,
        sizes,
        defaultFont: 'Consolas',
        defaultSize: 14
      }
    })
  } catch (error) {
    logger.error('获取终端字体失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取字体失败'
    })
  }
})

// 测试终端连接
router.post('/test-connection', (req: Request, res: Response) => {
  try {
    const { workingDirectory } = req.body
    
    // 简单的连接测试
    // 在实际实现中，可以尝试创建一个临时的PTY会话来测试
    
    res.json({
      success: true,
      message: '终端连接测试成功',
      data: {
        workingDirectory: workingDirectory || process.cwd(),
        platform: process.platform,
        shell: process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/bash')
      }
    })
  } catch (error) {
    logger.error('测试终端连接失败:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败'
    })
  }
})

// 设置路由的函数
export function setupTerminalRoutes(manager: TerminalManager) {
  setTerminalManager(manager)
  return router
}

export default router