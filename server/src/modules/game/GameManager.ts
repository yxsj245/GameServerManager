import { spawn, ChildProcess } from 'child_process'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import winston from 'winston'
import path from 'path'
import fs from 'fs/promises'
import { EventEmitter } from 'events'

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
  createdAt: Date
  updatedAt: Date
}

interface GameInstance {
  id: string
  config: GameConfig
  process?: ChildProcess
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed'
  startTime?: Date
  stopTime?: Date
  players: GamePlayer[]
  stats: GameStats
  logs: GameLog[]
}

interface GamePlayer {
  name: string
  uuid?: string
  joinTime: Date
  ip?: string
}

interface GameStats {
  uptime: number
  playerCount: number
  maxPlayerCount: number
  cpuUsage: number
  memoryUsage: number
  networkIn: number
  networkOut: number
}

interface GameLog {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: 'stdout' | 'stderr' | 'system'
}

interface GameTemplate {
  id: string
  name: string
  type: 'minecraft' | 'terraria' | 'custom'
  description: string
  icon: string
  defaultConfig: Partial<GameConfig>
  setupSteps: string[]
}

export class GameManager extends EventEmitter {
  private games: Map<string, GameInstance> = new Map()
  private io: SocketIOServer
  private logger: winston.Logger
  private configPath: string
  private templates: GameTemplate[]

  constructor(io: SocketIOServer, logger: winston.Logger) {
    super()
    this.io = io
    this.logger = logger
    this.configPath = path.resolve(process.cwd(), 'data', 'games')
    
    // 初始化游戏模板
    this.templates = this.initializeTemplates()
    
    this.logger.info('游戏管理器初始化完成')
    
    // 定期更新游戏统计信息
    setInterval(() => {
      this.updateGameStats()
    }, 5000) // 每5秒更新一次
    
    // 初始化时加载已保存的游戏配置
    this.loadGameConfigs()
  }

  /**
   * 初始化游戏模板
   */
  private initializeTemplates(): GameTemplate[] {
    return [
      {
        id: 'minecraft-vanilla',
        name: 'Minecraft 原版服务器',
        type: 'minecraft',
        description: 'Minecraft 官方原版服务器',
        icon: '🎮',
        defaultConfig: {
          type: 'minecraft',
          args: ['-Xmx2G', '-Xms1G', '-jar', 'server.jar', 'nogui'],
          maxMemory: '2G',
          minMemory: '1G',
          port: 25565,
          maxPlayers: 20
        },
        setupSteps: [
          '下载 Minecraft 服务器 JAR 文件',
          '配置 server.properties',
          '同意 EULA',
          '配置内存分配'
        ]
      },
      {
        id: 'minecraft-forge',
        name: 'Minecraft Forge 服务器',
        type: 'minecraft',
        description: 'Minecraft Forge 模组服务器',
        icon: '⚒️',
        defaultConfig: {
          type: 'minecraft',
          args: ['-Xmx4G', '-Xms2G', '-jar', 'forge-server.jar', 'nogui'],
          maxMemory: '4G',
          minMemory: '2G',
          port: 25565,
          maxPlayers: 20
        },
        setupSteps: [
          '下载 Minecraft Forge 安装器',
          '运行安装器安装服务器',
          '配置 server.properties',
          '同意 EULA',
          '安装模组到 mods 文件夹'
        ]
      },
      {
        id: 'terraria',
        name: 'Terraria 服务器',
        type: 'terraria',
        description: 'Terraria 专用服务器',
        icon: '🌍',
        defaultConfig: {
          type: 'terraria',
          args: ['-server', '-world', 'world.wld'],
          port: 7777,
          maxPlayers: 8
        },
        setupSteps: [
          '下载 Terraria 专用服务器',
          '创建或导入世界文件',
          '配置服务器设置'
        ]
      },
      {
        id: 'custom',
        name: '自定义游戏服务器',
        type: 'custom',
        description: '自定义配置的游戏服务器',
        icon: '🔧',
        defaultConfig: {
          type: 'custom',
          args: []
        },
        setupSteps: [
          '指定可执行文件路径',
          '配置启动参数',
          '设置工作目录'
        ]
      }
    ]
  }

  /**
   * 获取游戏模板列表
   */
  public getTemplates(): GameTemplate[] {
    return this.templates
  }

  /**
   * 创建新游戏
   */
  public async createGame(socket: Socket, config: Omit<GameConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const gameId = uuidv4()
      const gameConfig: GameConfig = {
        ...config,
        id: gameId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      // 创建游戏实例
      const gameInstance: GameInstance = {
        id: gameId,
        config: gameConfig,
        status: 'stopped',
        players: [],
        stats: {
          uptime: 0,
          playerCount: 0,
          maxPlayerCount: 0,
          cpuUsage: 0,
          memoryUsage: 0,
          networkIn: 0,
          networkOut: 0
        },
        logs: []
      }
      
      this.games.set(gameId, gameInstance)
      
      // 保存配置到文件
      await this.saveGameConfig(gameConfig)
      
      // 通知客户端
      this.io.emit('game-created', {
        game: this.getGameInfo(gameInstance)
      })
      
      this.logger.info(`游戏创建成功: ${gameConfig.name} (${gameId})`)
      
    } catch (error) {
      this.logger.error('创建游戏失败:', error)
      socket.emit('game-error', {
        error: error instanceof Error ? error.message : '创建游戏失败'
      })
    }
  }

  /**
   * 启动游戏
   */
  public async startGame(socket: Socket, gameId: string): Promise<void> {
    try {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('game-error', { error: '游戏不存在' })
        return
      }
      
      if (game.status !== 'stopped' && game.status !== 'crashed') {
        socket.emit('game-error', { error: '游戏已在运行或正在启动' })
        return
      }
      
      this.logger.info(`启动游戏: ${game.config.name} (${gameId})`)
      
      // 更新状态
      game.status = 'starting'
      game.startTime = new Date()
      game.logs = []
      
      this.io.emit('game-status-changed', {
        gameId,
        status: game.status,
        startTime: game.startTime
      })
      
      // 确保工作目录存在
      await fs.mkdir(game.config.workingDirectory, { recursive: true })
      
      // 启动游戏进程
      const gameProcess = spawn(game.config.executable, game.config.args, {
        cwd: game.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          JAVA_HOME: game.config.javaPath || process.env.JAVA_HOME
        }
      })
      
      game.process = gameProcess
      
      // 处理游戏输出
      gameProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString()
        this.addGameLog(game, 'info', message, 'stdout')
        this.parseGameOutput(game, message)
        
        socket.emit('game-output', {
          gameId,
          data: message
        })
      })
      
      // 处理游戏错误输出
      gameProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString()
        this.addGameLog(game, 'error', message, 'stderr')
        
        socket.emit('game-output', {
          gameId,
          data: message
        })
      })
      
      // 处理进程退出
      gameProcess.on('exit', (code, signal) => {
        this.logger.info(`游戏进程退出: ${game.config.name}, 退出码: ${code}, 信号: ${signal}`)
        
        game.status = code === 0 ? 'stopped' : 'crashed'
        game.stopTime = new Date()
        game.process = undefined
        game.players = []
        
        this.addGameLog(game, 'info', `游戏进程退出，退出码: ${code}`, 'system')
        
        this.io.emit('game-status-changed', {
          gameId,
          status: game.status,
          stopTime: game.stopTime,
          exitCode: code
        })
        
        // 如果启用了自动重启且不是正常退出
        if (game.config.autoRestart && code !== 0) {
          setTimeout(() => {
            this.startGame(socket, gameId)
          }, 5000) // 5秒后重启
        }
      })
      
      // 处理进程错误
      gameProcess.on('error', (error) => {
        this.logger.error(`游戏进程错误 ${game.config.name}:`, error)
        
        game.status = 'crashed'
        game.stopTime = new Date()
        game.process = undefined
        
        this.addGameLog(game, 'error', `进程错误: ${error.message}`, 'system')
        
        this.io.emit('game-status-changed', {
          gameId,
          status: game.status,
          error: error.message
        })
      })
      
      // 等待一段时间确认启动成功
      setTimeout(() => {
        if (game.process && !game.process.killed) {
          game.status = 'running'
          this.io.emit('game-status-changed', {
            gameId,
            status: game.status
          })
          this.addGameLog(game, 'info', '游戏启动成功', 'system')
        }
      }, 3000)
      
    } catch (error) {
      this.logger.error('启动游戏失败:', error)
      socket.emit('game-error', {
        gameId,
        error: error instanceof Error ? error.message : '启动游戏失败'
      })
    }
  }

  /**
   * 停止游戏
   */
  public async stopGame(socket: Socket, gameId: string): Promise<void> {
    try {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('game-error', { error: '游戏不存在' })
        return
      }
      
      if (game.status !== 'running' && game.status !== 'starting') {
        socket.emit('game-error', { error: '游戏未在运行' })
        return
      }
      
      this.logger.info(`停止游戏: ${game.config.name} (${gameId})`)
      
      game.status = 'stopping'
      
      this.io.emit('game-status-changed', {
        gameId,
        status: game.status
      })
      
      if (game.process && !game.process.killed) {
        // 尝试优雅关闭
        if (game.config.type === 'minecraft') {
          game.process.stdin?.write('stop\n')
        } else {
          game.process.kill('SIGTERM')
        }
        
        // 如果10秒后还没有退出，强制杀死进程
        setTimeout(() => {
          if (game.process && !game.process.killed) {
            game.process.kill('SIGKILL')
          }
        }, 10000)
      }
      
    } catch (error) {
      this.logger.error('停止游戏失败:', error)
      socket.emit('game-error', {
        gameId,
        error: error instanceof Error ? error.message : '停止游戏失败'
      })
    }
  }

  /**
   * 重启游戏
   */
  public async restartGame(socket: Socket, gameId: string): Promise<void> {
    try {
      await this.stopGame(socket, gameId)
      
      // 等待游戏完全停止后再启动
      const game = this.games.get(gameId)
      if (game) {
        const checkStopped = () => {
          if (game.status === 'stopped' || game.status === 'crashed') {
            this.startGame(socket, gameId)
          } else {
            setTimeout(checkStopped, 1000)
          }
        }
        setTimeout(checkStopped, 1000)
      }
      
    } catch (error) {
      this.logger.error('重启游戏失败:', error)
      socket.emit('game-error', {
        gameId,
        error: error instanceof Error ? error.message : '重启游戏失败'
      })
    }
  }

  /**
   * 发送命令到游戏
   */
  public sendCommand(socket: Socket, gameId: string, command: string): void {
    try {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('game-error', { error: '游戏不存在' })
        return
      }
      
      if (game.status !== 'running' || !game.process) {
        socket.emit('game-error', { error: '游戏未在运行' })
        return
      }
      
      this.addGameLog(game, 'info', `> ${command}`, 'system')
      
      if (game.process.stdin && !game.process.stdin.destroyed) {
        game.process.stdin.write(command + '\n')
      }
      
    } catch (error) {
      this.logger.error('发送游戏命令失败:', error)
      socket.emit('game-error', {
        gameId,
        error: error instanceof Error ? error.message : '发送命令失败'
      })
    }
  }

  /**
   * 删除游戏
   */
  public async deleteGame(socket: Socket, gameId: string): Promise<void> {
    try {
      const game = this.games.get(gameId)
      if (!game) {
        socket.emit('game-error', { error: '游戏不存在' })
        return
      }
      
      // 如果游戏正在运行，先停止
      if (game.status === 'running' || game.status === 'starting') {
        await this.stopGame(socket, gameId)
        
        // 等待游戏停止
        await new Promise(resolve => {
          const checkStopped = () => {
            if (game.status === 'stopped' || game.status === 'crashed') {
              resolve(void 0)
            } else {
              setTimeout(checkStopped, 1000)
            }
          }
          setTimeout(checkStopped, 1000)
        })
      }
      
      // 删除配置文件
      await this.deleteGameConfig(gameId)
      
      // 从内存中移除
      this.games.delete(gameId)
      
      // 通知客户端
      this.io.emit('game-deleted', { gameId })
      
      this.logger.info(`游戏删除成功: ${game.config.name} (${gameId})`)
      
    } catch (error) {
      this.logger.error('删除游戏失败:', error)
      socket.emit('game-error', {
        gameId,
        error: error instanceof Error ? error.message : '删除游戏失败'
      })
    }
  }

  /**
   * 获取游戏列表
   */
  public getGames(): any[] {
    return Array.from(this.games.values()).map(game => this.getGameInfo(game))
  }

  /**
   * 获取游戏信息
   */
  private getGameInfo(game: GameInstance): any {
    return {
      id: game.id,
      name: game.config.name,
      type: game.config.type,
      status: game.status,
      playerCount: game.players.length,
      maxPlayers: game.config.maxPlayers || 0,
      uptime: game.startTime ? Date.now() - game.startTime.getTime() : 0,
      stats: game.stats,
      port: game.config.port,
      autoStart: game.config.autoStart,
      autoRestart: game.config.autoRestart,
      description: game.config.description,
      icon: game.config.icon,
      createdAt: game.config.createdAt,
      updatedAt: game.config.updatedAt
    }
  }

  /**
   * 解析游戏输出
   */
  private parseGameOutput(game: GameInstance, output: string): void {
    // 根据游戏类型解析输出
    if (game.config.type === 'minecraft') {
      this.parseMinecraftOutput(game, output)
    }
    // 可以添加其他游戏类型的解析
  }

  /**
   * 解析Minecraft输出
   */
  private parseMinecraftOutput(game: GameInstance, output: string): void {
    // 玩家加入
    const joinMatch = output.match(/\[.*\] \[.*\/INFO\]: (\w+) joined the game/)
    if (joinMatch) {
      const playerName = joinMatch[1]
      if (!game.players.find(p => p.name === playerName)) {
        game.players.push({
          name: playerName,
          joinTime: new Date()
        })
        this.io.emit('player-joined', {
          gameId: game.id,
          playerName,
          playerCount: game.players.length
        })
      }
    }
    
    // 玩家离开
    const leaveMatch = output.match(/\[.*\] \[.*\/INFO\]: (\w+) left the game/)
    if (leaveMatch) {
      const playerName = leaveMatch[1]
      game.players = game.players.filter(p => p.name !== playerName)
      this.io.emit('player-left', {
        gameId: game.id,
        playerName,
        playerCount: game.players.length
      })
    }
    
    // 服务器启动完成
    if (output.includes('Done (') && output.includes('For help, type "help"')) {
      game.status = 'running'
      this.io.emit('game-status-changed', {
        gameId: game.id,
        status: game.status
      })
    }
  }

  /**
   * 添加游戏日志
   */
  private addGameLog(game: GameInstance, level: GameLog['level'], message: string, source: GameLog['source']): void {
    const log: GameLog = {
      timestamp: new Date(),
      level,
      message: message.trim(),
      source
    }
    
    game.logs.push(log)
    
    // 限制日志数量
    if (game.logs.length > 1000) {
      game.logs = game.logs.slice(-1000)
    }
    
    // 发送日志到客户端
    this.io.emit('game-log', {
      gameId: game.id,
      log
    })
  }

  /**
   * 更新游戏统计信息
   */
  private updateGameStats(): void {
    for (const game of this.games.values()) {
      if (game.status === 'running' && game.process) {
        // 更新运行时间
        if (game.startTime) {
          game.stats.uptime = Date.now() - game.startTime.getTime()
        }
        
        // 更新玩家数量
        game.stats.playerCount = game.players.length
        game.stats.maxPlayerCount = Math.max(game.stats.maxPlayerCount, game.players.length)
        
        // 发送统计信息到客户端
        this.io.emit('game-stats-updated', {
          gameId: game.id,
          stats: game.stats
        })
      }
    }
  }

  /**
   * 保存游戏配置
   */
  private async saveGameConfig(config: GameConfig): Promise<void> {
    try {
      await fs.mkdir(this.configPath, { recursive: true })
      const configFile = path.join(this.configPath, `${config.id}.json`)
      await fs.writeFile(configFile, JSON.stringify(config, null, 2))
    } catch (error) {
      this.logger.error('保存游戏配置失败:', error)
    }
  }

  /**
   * 删除游戏配置
   */
  private async deleteGameConfig(gameId: string): Promise<void> {
    try {
      const configFile = path.join(this.configPath, `${gameId}.json`)
      await fs.unlink(configFile)
    } catch (error) {
      this.logger.error('删除游戏配置失败:', error)
    }
  }

  /**
   * 加载游戏配置
   */
  private async loadGameConfigs(): Promise<void> {
    try {
      await fs.mkdir(this.configPath, { recursive: true })
      const files = await fs.readdir(this.configPath)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const configFile = path.join(this.configPath, file)
            const configData = await fs.readFile(configFile, 'utf-8')
            const config: GameConfig = JSON.parse(configData)
            
            const gameInstance: GameInstance = {
              id: config.id,
              config,
              status: 'stopped',
              players: [],
              stats: {
                uptime: 0,
                playerCount: 0,
                maxPlayerCount: 0,
                cpuUsage: 0,
                memoryUsage: 0,
                networkIn: 0,
                networkOut: 0
              },
              logs: []
            }
            
            this.games.set(config.id, gameInstance)
            
            // 如果启用了自动启动
            if (config.autoStart) {
              setTimeout(() => {
                // 这里需要一个socket实例，暂时跳过自动启动
                // this.startGame(socket, config.id)
              }, 5000)
            }
            
          } catch (error) {
            this.logger.error(`加载游戏配置失败 ${file}:`, error)
          }
        }
      }
      
      this.logger.info(`加载了 ${this.games.size} 个游戏配置`)
      
    } catch (error) {
      this.logger.error('加载游戏配置失败:', error)
    }
  }

  /**
   * 清理所有游戏
   */
  public cleanup(): void {
    this.logger.info('开始清理所有游戏进程...')
    
    for (const game of this.games.values()) {
      if (game.process && !game.process.killed) {
        try {
          game.process.kill('SIGTERM')
        } catch (error) {
          this.logger.error(`清理游戏进程失败 ${game.config.name}:`, error)
        }
      }
    }
    
    this.logger.info('所有游戏进程已清理完成')
  }
}