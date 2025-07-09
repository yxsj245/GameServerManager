import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { AuthManager } from '../modules/auth/AuthManager.js'
import { authenticateToken, AuthenticatedRequest, requireAdmin } from '../middleware/auth.js'
import logger from '../utils/logger.js'
import Joi from 'joi'

const router = Router()

// 登录限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: {
    error: '请求过于频繁',
    message: '登录尝试次数过多，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
})

// 验证schemas
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': '用户名只能包含字母和数字',
    'string.min': '用户名至少3个字符',
    'string.max': '用户名最多30个字符',
    'any.required': '用户名是必填项'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': '密码至少6个字符',
    'any.required': '密码是必填项'
  })
})

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'any.required': '原密码是必填项'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': '新密码至少6个字符',
    'any.required': '新密码是必填项'
  })
})

const changeUsernameSchema = Joi.object({
  newUsername: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': '用户名只能包含字母和数字',
    'string.min': '用户名至少3个字符',
    'string.max': '用户名最多30个字符',
    'any.required': '新用户名是必填项'
  })
})

// 设置认证路由的函数
export function setupAuthRoutes(authManager: AuthManager): Router {
  // 登录接口
  router.post('/login', loginLimiter, async (req: Request, res: Response) => {
    try {
      if (!authManager) {
        return res.status(500).json({ error: '认证管理器未初始化' })
      }

    // 验证请求数据
    const { error, value } = loginSchema.validate(req.body)
    if (error) {
      return res.status(400).json({
        error: '请求数据无效',
        message: error.details[0].message
      })
    }

    const { username, password } = value
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown'
    
    const result = await authManager.login(username, password, clientIP)
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        token: result.token,
        user: result.user
      })
    } else {
      res.status(401).json({
        success: false,
        message: result.message
      })
    }
  } catch (error) {
    logger.error('登录接口错误:', error)
    res.status(500).json({
      error: '服务器内部错误',
      message: '登录失败，请稍后重试'
    })
  }
})

  // 验证token接口
  router.get('/verify', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      user: req.user,
      message: 'Token有效'
    })
  })

  // 修改密码接口
  router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!authManager) {
        return res.status(500).json({ error: '认证管理器未初始化' })
      }

      // 验证请求数据
      const { error, value } = changePasswordSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: '请求数据无效',
          message: error.details[0].message
        })
      }

      const { oldPassword, newPassword } = value
      const username = req.user!.username
      
      const result = await authManager.changePassword(username, oldPassword, newPassword)
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message
        })
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        })
      }
    } catch (error) {
      logger.error('修改密码接口错误:', error)
      res.status(500).json({
        error: '服务器内部错误',
        message: '修改密码失败，请稍后重试'
      })
    }
  })

  // 修改用户名接口
  router.post('/change-username', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!authManager) {
        return res.status(500).json({ error: '认证管理器未初始化' })
      }

      // 验证请求数据
      const { error, value } = changeUsernameSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          error: '请求数据无效',
          message: error.details[0].message
        })
      }

      const { newUsername } = value
      const currentUsername = req.user!.username
      
      const result = await authManager.changeUsername(currentUsername, newUsername)
      
      if (result.success) {
        // 更新用户信息
        req.user!.username = newUsername
        
        res.json({
          success: true,
          message: result.message,
          user: {
            id: req.user!.userId,
            username: newUsername,
            role: req.user!.role
          }
        })
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        })
      }
    } catch (error) {
      logger.error('修改用户名接口错误:', error)
      res.status(500).json({
        error: '服务器内部错误',
        message: '修改用户名失败，请稍后重试'
      })
    }
  })

  // 获取用户列表（仅管理员）
  router.get('/users', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!authManager) {
        return res.status(500).json({ error: '认证管理器未初始化' })
      }

      const users = authManager.getUsers()
      res.json({
        success: true,
        users
      })
    } catch (error) {
      logger.error('获取用户列表错误:', error)
      res.status(500).json({
        error: '服务器内部错误',
        message: '获取用户列表失败'
      })
    }
  })

  // 获取登录尝试记录（仅管理员）
  router.get('/login-attempts', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!authManager) {
        return res.status(500).json({ error: '认证管理器未初始化' })
      }

      const limit = parseInt(req.query.limit as string) || 100
      const attempts = authManager.getLoginAttempts(limit)
      
      res.json({
        success: true,
        attempts
      })
    } catch (error) {
      logger.error('获取登录尝试记录错误:', error)
      res.status(500).json({
        error: '服务器内部错误',
        message: '获取登录记录失败'
      })
    }
  })

  // 登出接口（客户端处理，服务端记录）
  router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info(`用户 ${req.user!.username} 登出`)
      res.json({
        success: true,
        message: '登出成功'
      })
    } catch (error) {
      logger.error('登出接口错误:', error)
      res.status(500).json({
        error: '服务器内部错误',
        message: '登出失败'
      })
    }
  })

  return router
}