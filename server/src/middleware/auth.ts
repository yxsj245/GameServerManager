import { Request, Response, NextFunction } from 'express'
import { AuthManager } from '../modules/auth/AuthManager.js'
import logger from '../utils/logger.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    username: string
    role: string
  }
}

let authManager: AuthManager

export function setAuthManager(manager: AuthManager) {
  authManager = manager
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: '访问被拒绝',
      message: '需要提供访问令牌'
    })
  }

  if (!authManager) {
    logger.error('认证管理器未初始化')
    return res.status(500).json({
      error: '服务器错误',
      message: '认证服务不可用'
    })
  }

  const decoded = authManager.verifyToken(token)
  
  if (!decoded) {
    return res.status(403).json({
      error: '访问被拒绝',
      message: '无效或过期的访问令牌'
    })
  }

  req.user = {
    userId: decoded.userId,
    username: decoded.username,
    role: decoded.role
  }

  next()
}

export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: '访问被拒绝',
        message: '需要身份验证'
      })
    }

    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({
        error: '访问被拒绝',
        message: '权限不足'
      })
    }

    next()
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireRole('admin')(req, res, next)
}