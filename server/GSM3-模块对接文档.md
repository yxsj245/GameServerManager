# GSM3 后端模块对接文档

## 概述

GSM3 是一个功能强大的游戏服务器管理面板，采用模块化架构设计。本文档为开发者提供了详细的模块对接指南，帮助您快速理解和扩展系统功能。

## 系统架构

### 核心模块

- **AuthManager**: 用户认证和权限管理
- **ConfigManager**: 配置文件管理
- **TerminalManager**: 终端会话管理
- **GameManager**: 游戏实例管理
- **InstanceManager**: 通用实例管理
- **SystemManager**: 系统监控和管理
- **SteamCMDManager**: Steam 游戏部署管理
- **SchedulerManager**: 定时任务管理

### 技术栈

- **后端**: Node.js + TypeScript + Express
- **实时通信**: Socket.IO
- **数据存储**: JSON 文件
- **日志**: Winston
- **验证**: Joi
- **进程管理**: node-pty

## 模块详细说明

### 1. AuthManager (认证管理器)

#### 接口定义

```typescript
export interface User {
  id: string
  username: string
  password: string
  role: 'admin' | 'user'
  createdAt: string
  lastLogin?: string
  loginAttempts: number
  lockedUntil?: string
}

export interface LoginResult {
  success: boolean
  message: string
  token?: string
  user?: {
    id: string
    username: string
    role: string
  }
}
```

#### 主要方法

```typescript
class AuthManager {
  // 用户登录
  async login(username: string, password: string, clientIP: string): Promise<LoginResult>
  
  // 验证令牌
  verifyToken(token: string): any
  
  // 修改密码
  async changePassword(username: string, oldPassword: string, newPassword: string): Promise<{success: boolean, message: string}>
  
  // 修改用户名
  async changeUsername(currentUsername: string, newUsername: string): Promise<{success: boolean, message: string}>
  
  // 获取所有用户
  getUsers(): User[]
}
```

#### 使用示例

```typescript
import { AuthManager } from './modules/auth/AuthManager.js'
import { ConfigManager } from './modules/config/ConfigManager.js'

const configManager = new ConfigManager()
const authManager = new AuthManager(configManager, logger)

// 用户登录
const loginResult = await authManager.login('admin', 'password', '127.0.0.1')
if (loginResult.success) {
  console.log('登录成功:', loginResult.token)
}
```

### 2. ConfigManager (配置管理器)

#### 接口定义

```typescript
interface AppConfig {
  server: {
    port: number
    host: string
  }
  auth: {
    jwtSecret: string
    tokenExpiry: string
    maxLoginAttempts: number
    lockoutDuration: number
  }
  steamcmd: {
    installMode: 'auto' | 'manual'
    installPath?: string
  }
}
```

#### 主要方法

```typescript
class ConfigManager {
  // 获取完整配置
  getConfig(): AppConfig
  
  // 获取服务器配置
  getServerConfig(): AppConfig['server']
  
  // 获取认证配置
  getAuthConfig(): AppConfig['auth']
  
  // 获取 SteamCMD 配置
  getSteamCMDConfig(): AppConfig['steamcmd']
  
  // 更新配置
  async updateConfig(updates: Partial<AppConfig>): Promise<void>
}
```

### 3. TerminalManager (终端管理器)

#### 接口定义

```typescript
interface PtySession {
  id: string
  pty: IPty
  createdAt: Date
  lastActivity: Date
  title?: string
  cwd?: string
}

interface TerminalInput {
  sessionId: string
  data: string
}
```

#### 主要方法

```typescript
class TerminalManager {
  // 创建新的终端会话
  createSession(socket: Socket, options?: any): string
  
  // 处理终端输入
  handleInput(socket: Socket, data: TerminalInput): void
  
  // 调整终端大小
  handleResize(socket: Socket, data: any): void
  
  // 获取会话列表
  getSessions(): string[]
  
  // 销毁会话
  destroySession(sessionId: string): void
  
  // 清理所有会话
  cleanup(): void
}
```

#### Socket.IO 事件

```typescript
// 客户端发送的事件
socket.on('terminal:create', (options) => { /* 创建终端 */ })
socket.on('terminal:input', (data) => { /* 发送输入 */ })
socket.on('terminal:resize', (data) => { /* 调整大小 */ })
socket.on('terminal:destroy', (sessionId) => { /* 销毁终端 */ })

// 服务端发送的事件
socket.emit('terminal:created', { sessionId })
socket.emit('terminal:data', { sessionId, data })
socket.emit('terminal:destroyed', { sessionId })
```

### 4. GameManager (游戏管理器)

#### 接口定义

```typescript
interface GameConfig {
  id: string
  name: string
  type: 'minecraft' | 'terraria' | 'custom'
  executable: string
  args: string[]
  workingDirectory: string
  autoStart: boolean
  autoRestart: boolean
  maxMemory?: string
  minMemory?: string
  javaPath?: string
  port?: number
  maxPlayers?: number
  description?: string
  icon?: string
}

interface GameTemplate {
  id: string
  name: string
  type: 'minecraft' | 'terraria' | 'custom'
  description: string
  defaultConfig: Partial<GameConfig>
}
```

#### 主要方法

```typescript
class GameManager extends EventEmitter {
  // 创建游戏
  async createGame(socket: Socket, config: GameConfig): Promise<void>
  
  // 启动游戏
  async startGame(socket: Socket, gameId: string): Promise<void>
  
  // 停止游戏
  async stopGame(socket: Socket, gameId: string): Promise<void>
  
  // 重启游戏
  async restartGame(socket: Socket, gameId: string): Promise<void>
  
  // 获取游戏列表
  getGames(): any[]
  
  // 获取游戏模板
  getTemplates(): GameTemplate[]
  
  // 删除游戏
  async deleteGame(socket: Socket, gameId: string): Promise<void>
  
  // 清理资源
  cleanup(): void
}
```

#### 事件

```typescript
// GameManager 发出的事件
gameManager.on('gameStarted', (gameId) => { /* 游戏启动 */ })
gameManager.on('gameStopped', (gameId) => { /* 游戏停止 */ })
gameManager.on('gameError', (gameId, error) => { /* 游戏错误 */ })
gameManager.on('gameOutput', (gameId, data) => { /* 游戏输出 */ })
```

### 5. InstanceManager (实例管理器)

#### 接口定义

```typescript
interface Instance {
  id: string
  name: string
  description: string
  workingDirectory: string
  startCommand: string
  autoStart: boolean
  stopCommand: 'ctrl+c' | 'stop' | 'exit'
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  createdAt: string
  lastStarted?: string
  lastStopped?: string
  terminalSessionId?: string
}
```

#### 主要方法

```typescript
class InstanceManager extends EventEmitter {
  // 创建实例
  async createInstance(instanceData: Omit<Instance, 'id' | 'status' | 'createdAt'>): Promise<Instance>
  
  // 启动实例
  async startInstance(instanceId: string): Promise<void>
  
  // 停止实例
  async stopInstance(instanceId: string): Promise<void>
  
  // 重启实例
  async restartInstance(instanceId: string): Promise<void>
  
  // 获取实例列表
  getInstances(): Instance[]
  
  // 获取单个实例
  getInstance(id: string): Instance | undefined
  
  // 删除实例
  async deleteInstance(instanceId: string): Promise<void>
  
  // 清理资源
  async cleanup(): Promise<void>
}
```

### 6. SystemManager (系统管理器)

#### 接口定义

```typescript
interface SystemStats {
  timestamp: string
  cpu: {
    usage: number
    cores: number
  }
  memory: {
    total: number
    used: number
    free: number
    usage: number
  }
  disk: {
    total: number
    used: number
    free: number
    usage: number
  }
  network: {
    bytesReceived: number
    bytesSent: number
  }
  uptime: number
}

interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'custom'
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
  resolved: boolean
}
```

#### 主要方法

```typescript
class SystemManager extends EventEmitter {
  // 获取系统统计信息
  async getSystemStats(): Promise<SystemStats>
  
  // 获取历史统计数据
  getStatsHistory(hours?: number): SystemStats[]
  
  // 获取系统警报
  getAlerts(): SystemAlert[]
  
  // 开始监控
  startMonitoring(): void
  
  // 停止监控
  stopMonitoring(): void
  
  // 清理资源
  cleanup(): void
}
```

### 7. SteamCMDManager (Steam 部署管理器)

#### 接口定义

```typescript
interface SteamCMDStatus {
  isInstalled: boolean
  version?: string
  installPath?: string
  lastChecked?: string
}

interface SteamCMDInstallOptions {
  installPath: string
  onProgress?: (progress: number) => void
  onStatusChange?: (status: string) => void
}
```

#### 主要方法

```typescript
class SteamCMDManager {
  // 获取 SteamCMD 状态
  async getStatus(): Promise<SteamCMDStatus>
  
  // 安装 SteamCMD
  async install(options: SteamCMDInstallOptions): Promise<void>
  
  // 下载游戏服务器
  async downloadGameServer(appId: string, installDir: string, options?: any): Promise<void>
  
  // 验证游戏文件
  async validateGameFiles(appId: string, installDir: string): Promise<void>
}
```

### 8. SchedulerManager (定时任务管理器)

#### 接口定义

```typescript
interface ScheduledTask {
  id: string
  name: string
  type: 'power' | 'command'
  instanceId?: string
  instanceName?: string
  action?: 'start' | 'stop' | 'restart'
  command?: string
  schedule: string // Cron 表达式
  enabled: boolean
  nextRun?: string
  lastRun?: string
  createdAt: string
  updatedAt: string
}
```

#### 主要方法

```typescript
class SchedulerManager extends EventEmitter {
  // 创建定时任务
  async createTask(taskData: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduledTask>
  
  // 更新定时任务
  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask>
  
  // 删除定时任务
  async deleteTask(taskId: string): Promise<void>
  
  // 启用/禁用任务
  async toggleTask(taskId: string, enabled: boolean): Promise<ScheduledTask>
  
  // 获取任务列表
  getTasks(): ScheduledTask[]
  
  // 获取单个任务
  getTask(taskId: string): ScheduledTask | undefined
  
  // 设置依赖管理器
  setGameManager(gameManager: GameManager): void
  setInstanceManager(instanceManager: InstanceManager): void
  setTerminalManager(terminalManager: TerminalManager): void
}
```

## API 路由设计

### 认证相关 (/api/auth)

```typescript
// 登录
POST /api/auth/login
// 验证令牌
GET /api/auth/verify
// 修改密码
POST /api/auth/change-password
// 修改用户名
POST /api/auth/change-username
// 获取用户列表（管理员）
GET /api/auth/users
```

### 游戏管理 (/api/games)

```typescript
// 获取游戏模板
GET /api/games/templates
// 获取游戏列表
GET /api/games
// 创建游戏
POST /api/games
// 获取游戏信息
GET /api/games/:gameId
// 启动游戏
POST /api/games/:gameId/start
// 停止游戏
POST /api/games/:gameId/stop
// 重启游戏
POST /api/games/:gameId/restart
// 删除游戏
DELETE /api/games/:gameId
```

### 实例管理 (/api/instances)

```typescript
// 获取实例列表
GET /api/instances
// 创建实例
POST /api/instances
// 获取实例信息
GET /api/instances/:instanceId
// 启动实例
POST /api/instances/:instanceId/start
// 停止实例
POST /api/instances/:instanceId/stop
// 重启实例
POST /api/instances/:instanceId/restart
// 删除实例
DELETE /api/instances/:instanceId
```

### 系统监控 (/api/system)

```typescript
// 获取系统状态
GET /api/system/stats
// 获取历史数据
GET /api/system/history
// 获取系统警报
GET /api/system/alerts
```

### 定时任务 (/api/scheduled-tasks)

```typescript
// 获取任务列表
GET /api/scheduled-tasks
// 创建任务
POST /api/scheduled-tasks
// 更新任务
PUT /api/scheduled-tasks/:taskId
// 删除任务
DELETE /api/scheduled-tasks/:taskId
// 启用/禁用任务
POST /api/scheduled-tasks/:taskId/toggle
```

## 开发自定义模块

### 1. 创建模块基础结构

```typescript
// src/modules/custom/CustomManager.ts
import { EventEmitter } from 'events'
import winston from 'winston'

export class CustomManager extends EventEmitter {
  private logger: winston.Logger
  
  constructor(logger: winston.Logger) {
    super()
    this.logger = logger
  }
  
  // 实现您的业务逻辑
  async doSomething(): Promise<void> {
    this.logger.info('执行自定义操作')
    this.emit('customEvent', { message: '操作完成' })
  }
  
  // 清理资源
  cleanup(): void {
    this.logger.info('清理自定义管理器资源')
  }
}
```

### 2. 创建路由

```typescript
// src/routes/custom.ts
import { Router, Request, Response } from 'express'
import { CustomManager } from '../modules/custom/CustomManager.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()
let customManager: CustomManager

export function setCustomManager(manager: CustomManager) {
  customManager = manager
}

router.get('/status', authenticateToken, (req: Request, res: Response) => {
  try {
    if (!customManager) {
      return res.status(500).json({ error: '自定义管理器未初始化' })
    }
    
    res.json({
      success: true,
      data: { status: 'running' }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
})

export default router
```

### 3. 集成到主应用

```typescript
// src/index.ts
import { CustomManager } from './modules/custom/CustomManager.js'
import customRouter, { setCustomManager } from './routes/custom.js'

// 在 startServer 函数中初始化
const customManager = new CustomManager(logger)
setCustomManager(customManager)

// 注册路由
app.use('/api/custom', customRouter)

// 在关闭时清理
if (customManager) {
  customManager.cleanup()
}
```

## 最佳实践

### 1. 错误处理

```typescript
try {
  await someAsyncOperation()
} catch (error) {
  this.logger.error('操作失败:', error)
  throw new Error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`)
}
```

### 2. 事件发射

```typescript
// 发射事件时提供详细信息
this.emit('operationCompleted', {
  operationId: 'op-123',
  timestamp: new Date().toISOString(),
  result: 'success'
})
```

### 3. 资源清理

```typescript
cleanup(): void {
  // 清理定时器
  if (this.interval) {
    clearInterval(this.interval)
  }
  
  // 关闭连接
  if (this.connection) {
    this.connection.close()
  }
  
  // 清理事件监听器
  this.removeAllListeners()
}
```

### 4. 配置验证

```typescript
import Joi from 'joi'

const configSchema = Joi.object({
  name: Joi.string().required(),
  port: Joi.number().integer().min(1).max(65535).required(),
  enabled: Joi.boolean().default(true)
})

const { error, value } = configSchema.validate(config)
if (error) {
  throw new Error(`配置验证失败: ${error.details[0].message}`)
}
```

### 5. Socket.IO 集成

```typescript
// 在构造函数中接收 io 实例
constructor(io: SocketIOServer, logger: winston.Logger) {
  super()
  this.io = io
  this.logger = logger
  
  // 设置 Socket.IO 事件监听
  this.setupSocketHandlers()
}

private setupSocketHandlers(): void {
  this.io.on('connection', (socket) => {
    socket.on('custom:action', (data) => {
      this.handleCustomAction(socket, data)
    })
  })
}

private handleCustomAction(socket: Socket, data: any): void {
  try {
    // 处理客户端请求
    const result = this.processAction(data)
    
    // 发送响应
    socket.emit('custom:actionResult', {
      success: true,
      data: result
    })
  } catch (error) {
    socket.emit('custom:actionResult', {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    })
  }
}
```

## 调试和测试

### 1. 日志记录

```typescript
// 使用不同级别的日志
this.logger.debug('调试信息', { data })
this.logger.info('操作完成', { operationId })
this.logger.warn('警告信息', { warning })
this.logger.error('错误信息', error)
```

### 2. 单元测试示例

```typescript
// tests/CustomManager.test.ts
import { CustomManager } from '../src/modules/custom/CustomManager.js'
import winston from 'winston'

describe('CustomManager', () => {
  let customManager: CustomManager
  let logger: winston.Logger
  
  beforeEach(() => {
    logger = winston.createLogger({
      level: 'silent' // 测试时禁用日志输出
    })
    customManager = new CustomManager(logger)
  })
  
  afterEach(() => {
    customManager.cleanup()
  })
  
  it('should emit event when operation completes', (done) => {
    customManager.on('customEvent', (data) => {
      expect(data.message).toBe('操作完成')
      done()
    })
    
    customManager.doSomething()
  })
})
```

## 部署和配置

### 1. 环境变量

```bash
# .env 文件
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000
```

### 2. 生产环境配置

```typescript
// 生产环境优化
if (process.env.NODE_ENV === 'production') {
  // 启用集群模式
  // 配置更严格的安全策略
  // 优化日志输出
}
```

## 常见问题和解决方案

### 1. 内存泄漏

- 确保在 cleanup 方法中清理所有定时器和事件监听器
- 避免循环引用
- 定期监控内存使用情况

### 2. 进程管理

- 使用 node-pty 管理子进程
- 正确处理进程退出事件
- 实现进程重启机制

### 3. 并发控制

- 使用队列管理并发操作
- 实现操作锁机制
- 避免竞态条件

## 总结

本文档提供了 GSM3 后端系统的完整模块对接指南。通过遵循这些规范和最佳实践，您可以：

1. 快速理解系统架构
2. 开发自定义模块
3. 集成第三方服务
4. 扩展系统功能
5. 维护代码质量

如有任何问题或建议，请参考源代码或联系开发团队。

---

**版本**: 1.0.0  
**更新日期**: 2024年12月  
**维护者**: GSM3 开发团队