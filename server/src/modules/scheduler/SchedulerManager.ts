import { EventEmitter } from 'events'
import { promises as fs } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import cron from 'node-cron'
import cronParser from 'cron-parser'
import { GameManager } from '../game/GameManager.js'

export interface ScheduledTask {
  id: string
  name: string
  type: 'power' | 'command'
  instanceId?: string
  instanceName?: string
  action?: 'start' | 'stop' | 'restart'
  command?: string
  schedule: string
  enabled: boolean
  nextRun?: string
  lastRun?: string
  createdAt: string
  updatedAt: string
}

interface ScheduledTaskWithJob extends ScheduledTask {
  job?: cron.ScheduledTask
}

export class SchedulerManager extends EventEmitter {
  private tasks: Map<string, ScheduledTaskWithJob> = new Map()
  private configPath: string
  private logger: winston.Logger
  private gameManager: GameManager | null = null

  constructor(dataDir: string, logger: winston.Logger) {
    super()
    this.configPath = path.join(dataDir, 'scheduled-tasks.json')
    this.logger = logger
    this.loadTasks()
  }

  setGameManager(gameManager: GameManager) {
    this.gameManager = gameManager
  }

  private async loadTasks(): Promise<void> {
    try {
      // 确保数据目录存在
      await fs.mkdir(path.dirname(this.configPath), { recursive: true })
      
      try {
        const data = await fs.readFile(this.configPath, 'utf-8')
        const tasks: ScheduledTask[] = JSON.parse(data)
        
        for (const task of tasks) {
          // 确保任务有正确的nextRun时间
          if (!task.nextRun || new Date(task.nextRun) <= new Date()) {
            task.nextRun = this.getNextRunTime(task.schedule)
          }
          
          this.tasks.set(task.id, task)
          if (task.enabled) {
            this.scheduleTask(task.id)
          }
        }
        
        this.logger.info(`加载了 ${tasks.length} 个定时任务`)
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          this.logger.error('加载定时任务失败:', error)
        }
      }
    } catch (error) {
      this.logger.error('创建定时任务数据目录失败:', error)
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      const tasks = Array.from(this.tasks.values()).map(task => {
        const { job, ...taskData } = task
        return taskData
      })
      await fs.writeFile(this.configPath, JSON.stringify(tasks, null, 2))
    } catch (error) {
      this.logger.error('保存定时任务失败:', error)
      throw error
    }
  }

  private scheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task || !task.enabled) {
      return
    }

    try {
      // 验证cron表达式
      if (!cron.validate(task.schedule)) {
        this.logger.error(`无效的cron表达式: ${task.schedule}`)
        return
      }

      // 如果已经有任务在运行，先停止
      if (task.job) {
        task.job.stop()
      }

      // 创建新的定时任务
      task.job = cron.schedule(task.schedule, async () => {
        await this.executeTask(taskId)
      }, {
        scheduled: false,
        timezone: 'Asia/Shanghai'
      })

      // 设置下次执行时间
      task.nextRun = this.getNextRunTime(task.schedule)
      
      task.job.start()
      
      this.logger.info(`定时任务已调度: ${task.name} (${task.schedule}), 下次执行: ${task.nextRun}`)
    } catch (error) {
      this.logger.error(`调度定时任务失败: ${task.name}`, error)
    }
  }

  private unscheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task && task.job) {
      task.job.stop()
      delete task.job
      this.logger.info(`定时任务已停止: ${task.name}`)
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task || !task.enabled) {
      return
    }

    this.logger.info(`执行定时任务: ${task.name}`)
    
    try {
      if (task.type === 'power' && task.instanceId && task.action) {
        await this.executePowerAction(task.instanceId, task.action)
      } else if (task.type === 'command' && task.instanceId && task.command) {
        await this.executeCommand(task.instanceId, task.command)
      }

      // 更新最后执行时间和下次执行时间
      task.lastRun = new Date().toISOString()
      task.nextRun = this.getNextRunTime(task.schedule)
      task.updatedAt = new Date().toISOString()
      
      await this.saveTasks()
      
      this.emit('taskExecuted', {
        taskId,
        taskName: task.name,
        success: true
      })
      
      this.logger.info(`定时任务执行成功: ${task.name}`)
    } catch (error) {
      this.logger.error(`定时任务执行失败: ${task.name}`, error)
      
      this.emit('taskExecuted', {
        taskId,
        taskName: task.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async executePowerAction(instanceId: string, action: 'start' | 'stop' | 'restart'): Promise<void> {
    if (!this.gameManager) {
      throw new Error('GameManager未设置')
    }

    switch (action) {
      case 'start':
        await this.gameManager.startGameById(instanceId)
        break
      case 'stop':
        await this.gameManager.stopGameById(instanceId)
        break
      case 'restart':
        await this.gameManager.restartGameById(instanceId)
        break
      default:
        throw new Error(`未知的电源操作: ${action}`)
    }
  }

  private async executeCommand(instanceId: string, command: string): Promise<void> {
    if (!this.gameManager) {
      throw new Error('GameManager未设置')
    }

    // 向游戏实例发送命令
    await this.gameManager.sendCommandById(instanceId, command)
  }

  private getNextRunTime(schedule: string): string {
    try {
      // 使用cron-parser库精确计算下次执行时间
      const interval = cronParser.parseExpression(schedule, {
        tz: 'Asia/Shanghai'
      })
      const nextRun = interval.next().toDate()
      return nextRun.toISOString()
    } catch (error) {
      this.logger.error(`计算下次执行时间失败: ${schedule}`, error)
      return new Date().toISOString()
    }
  }

  // 公共API方法
  async createTask(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      ...taskData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextRun: this.getNextRunTime(taskData.schedule)
    }

    // 验证cron表达式
    if (!cron.validate(task.schedule)) {
      throw new Error('无效的cron表达式')
    }

    this.tasks.set(task.id, task)
    
    if (task.enabled) {
      this.scheduleTask(task.id)
    }
    
    await this.saveTasks()
    
    this.logger.info(`创建定时任务: ${task.name}`)
    
    // 返回时排除job属性以避免循环引用
    const { job, ...resultTask } = this.tasks.get(task.id)!
    return resultTask
  }

  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('定时任务不存在')
    }

    // 如果更新了schedule，验证新的cron表达式
    if (updates.schedule && !cron.validate(updates.schedule)) {
      throw new Error('无效的cron表达式')
    }

    // 停止当前任务
    this.unscheduleTask(taskId)

    // 更新任务数据
    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
      // 如果schedule被更新，重新计算nextRun时间
      nextRun: updates.schedule ? this.getNextRunTime(updates.schedule) : task.nextRun
    }
    
    this.tasks.set(taskId, updatedTask)
    
    // 如果任务启用，重新调度
    if (updatedTask.enabled) {
      this.scheduleTask(taskId)
    }
    
    await this.saveTasks()
    
    this.logger.info(`更新定时任务: ${updatedTask.name}`)
    
    // 返回时排除job属性以避免循环引用
    const { job, ...resultTask } = updatedTask
    return resultTask
  }

  async deleteTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('定时任务不存在')
    }

    // 停止任务
    this.unscheduleTask(taskId)
    
    // 删除任务
    this.tasks.delete(taskId)
    
    await this.saveTasks()
    
    this.logger.info(`删除定时任务: ${task.name}`)
  }

  async toggleTask(taskId: string, enabled: boolean): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error('定时任务不存在')
    }

    if (enabled) {
      task.enabled = true
      this.scheduleTask(taskId)
    } else {
      task.enabled = false
      this.unscheduleTask(taskId)
    }

    task.updatedAt = new Date().toISOString()
    await this.saveTasks()
    
    this.logger.info(`${enabled ? '启用' : '禁用'}定时任务: ${task.name}`)
    
    // 返回时排除job属性以避免循环引用
    const { job, ...resultTask } = task
    return resultTask
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values()).map(task => {
      const { job, ...taskData } = task
      return taskData
    })
  }

  getTask(taskId: string): ScheduledTask | undefined {
    const task = this.tasks.get(taskId)
    if (task) {
      const { job, ...taskData } = task
      return taskData
    }
    return undefined
  }

  // 清理所有任务
  destroy(): void {
    for (const task of this.tasks.values()) {
      if (task.job) {
        task.job.stop()
      }
    }
    this.tasks.clear()
    this.logger.info('定时任务管理器已销毁')
  }
}