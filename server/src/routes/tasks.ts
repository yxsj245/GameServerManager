import { Router, Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { taskManager } from '../modules/task/taskManager.js'
import logger from '../utils/logger.js'

const router = Router()

// 获取所有任务
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tasks = taskManager.getAllTasks()
    res.json({
      success: true,
      data: tasks
    })
  } catch (error: any) {
    logger.error('获取任务列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取任务列表失败',
      error: error.message
    })
  }
})

// 获取活跃任务
router.get('/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tasks = taskManager.getActiveTasks()
    res.json({
      success: true,
      data: tasks
    })
  } catch (error: any) {
    logger.error('获取活跃任务失败:', error)
    res.status(500).json({
      success: false,
      message: '获取活跃任务失败',
      error: error.message
    })
  }
})

// 获取单个任务
router.get('/:taskId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const task = taskManager.getTask(taskId)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      })
    }
    
    res.json({
      success: true,
      data: task
    })
  } catch (error: any) {
    logger.error('获取任务失败:', error)
    res.status(500).json({
      success: false,
      message: '获取任务失败',
      error: error.message
    })
  }
})

// 删除任务
router.delete('/:taskId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params
    const task = taskManager.getTask(taskId)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      })
    }
    
    // 只允许删除已完成或失败的任务
    if (task.status === 'pending' || task.status === 'running') {
      return res.status(400).json({
        success: false,
        message: '无法删除正在进行的任务'
      })
    }
    
    taskManager.deleteTask(taskId)
    
    res.json({
      success: true,
      message: '任务删除成功'
    })
  } catch (error: any) {
    logger.error('删除任务失败:', error)
    res.status(500).json({
      success: false,
      message: '删除任务失败',
      error: error.message
    })
  }
})

export default router