import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface Task {
  id: string
  type: 'compress' | 'extract'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  createdAt: Date
  updatedAt: Date
  data: any
}

export class TaskManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map()
  private dataDir: string

  constructor() {
    super()
    this.dataDir = path.join(process.cwd(), 'server', 'data')
    this.ensureDataDir()
  }

  private async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })
    } catch (error) {
      console.error('创建数据目录失败:', error)
    }
  }

  createTask(type: 'compress' | 'extract', data: any): string {
    const id = uuidv4()
    const task: Task = {
      id,
      type,
      status: 'pending',
      progress: 0,
      message: '任务已创建',
      createdAt: new Date(),
      updatedAt: new Date(),
      data
    }
    
    this.tasks.set(id, task)
    this.emit('taskCreated', task)
    return id
  }

  updateTask(id: string, updates: Partial<Task>) {
    const task = this.tasks.get(id)
    if (!task) return

    Object.assign(task, updates, { updatedAt: new Date() })
    this.tasks.set(id, task)
    this.emit('taskUpdated', task)
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  getActiveTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'pending' || task.status === 'running'
    )
  }

  deleteTask(id: string) {
    const task = this.tasks.get(id)
    if (task) {
      this.tasks.delete(id)
      this.emit('taskDeleted', task)
    }
  }

  // 清理完成的任务（保留最近100个）
  cleanupTasks() {
    const allTasks = Array.from(this.tasks.values())
    const completedTasks = allTasks
      .filter(task => task.status === 'completed' || task.status === 'failed')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    
    if (completedTasks.length > 100) {
      const tasksToDelete = completedTasks.slice(100)
      tasksToDelete.forEach(task => this.deleteTask(task.id))
    }
  }
}

// 全局任务管理器实例
export const taskManager = new TaskManager()

// 定期清理任务
setInterval(() => {
  taskManager.cleanupTasks()
}, 60000) // 每分钟清理一次