import { Server as SocketIOServer, Socket } from 'socket.io'
import winston from 'winston'
import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { EventEmitter } from 'events'

const execAsync = promisify(exec)

interface SystemInfo {
  platform: string
  arch: string
  hostname: string
  ipv4: string[]
  ipv6: string[]
  uptime: number
  totalMemory: number
  freeMemory: number
  cpuCount: number
  cpuModel: string
  nodeVersion: string
  serverVersion: string
  serverUptime: number
}

interface SystemStats {
  timestamp: Date
  cpu: {
    usage: number
    cores: number
    model: string
    speed: number
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
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  processes: {
    total: number
    running: number
    sleeping: number
  }
  load: {
    avg1: number
    avg5: number
    avg15: number
  }
}

interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  status: string
  startTime: Date
  command: string
}

interface ProcessInfoResponse {
  id: string
  pid: number
  name: string
  cpu: number
  memory: number
  status: string
  startTime: string
  command: string
}

interface DiskInfo {
  filesystem: string
  size: number
  used: number
  available: number
  usage: number
  mountpoint: string
}

interface NetworkInterface {
  name: string
  address: string
  netmask: string
  family: string
  mac: string
  internal: boolean
  cidr: string
}

interface ActivePort {
  port: number
  protocol: 'tcp' | 'udp'
  state: string
  process?: string
  pid?: number
  address: string
}

interface SystemAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'process'
  level: 'info' | 'warning' | 'critical'
  message: string
  value: number
  threshold: number
  timestamp: Date
  resolved: boolean
}

interface AlertThresholds {
  cpu: { warning: number; critical: number }
  memory: { warning: number; critical: number }
  disk: { warning: number; critical: number }
  network: { warning: number; critical: number }
}

export class SystemManager extends EventEmitter {
  private io: SocketIOServer
  private logger: winston.Logger
  private serverStartTime: Date
  private statsHistory: SystemStats[] = []
  private alerts: Map<string, SystemAlert> = new Map()
  private alertThresholds: AlertThresholds
  private monitoringInterval?: NodeJS.Timeout
  private lastNetworkStats: any = null

  constructor(io: SocketIOServer, logger: winston.Logger) {
    super()
    this.io = io
    this.logger = logger
    this.serverStartTime = new Date()
    
    // 默认告警阈值
    this.alertThresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      network: { warning: 100 * 1024 * 1024, critical: 500 * 1024 * 1024 } // MB/s
    }
    
    this.logger.info('系统监控管理器初始化完成')
    
    // 检测并输出当前系统的资源获取方法
    this.detectResourceMethods()
    
    // 开始监控
    this.startMonitoring()
  }

  /**
   * 检测当前系统的资源获取方法
   */
  private async detectResourceMethods(): Promise<void> {
    const platform = os.platform()
    
    if (platform === 'win32') {
      this.logger.info('系统平台: Windows')
      
      // 检测磁盘信息获取方法
      try {
        await execAsync('wmic logicaldisk get size,freespace,caption', { timeout: 5000 })
        this.logger.info('磁盘信息获取方法: WMIC命令')
      } catch (wmicError) {
        try {
          await execAsync('powershell "Get-WmiObject -Class Win32_LogicalDisk | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"', { timeout: 8000 })
          this.logger.info('磁盘信息获取方法: PowerShell WMI (WMIC不可用)')
        } catch (psError) {
          this.logger.warn('磁盘信息获取方法: 备用方案 (WMIC和PowerShell均不可用)')
        }
      }
    } else {
      this.logger.info(`系统平台: ${platform}`)
      this.logger.info('磁盘信息获取方法: Linux df命令')
    }
  }

  /**
   * 开始系统监控
   */
  private startMonitoring(): void {
    // 每5秒收集一次系统统计信息
    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await this.collectSystemStats()
        this.statsHistory.push(stats)
        
        // 保持最近1小时的数据 (720个数据点)
        if (this.statsHistory.length > 720) {
          this.statsHistory = this.statsHistory.slice(-720)
        }
        
        // 检查告警
        this.checkAlerts(stats)
        
        // 发送统计信息到客户端
        this.io.to('system-stats').emit('system-stats', stats)
        
      } catch (error) {
        this.logger.error('收集系统统计信息失败:', error)
      }
    }, 5000)
  }

  /**
   * 停止系统监控
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
  }

  /**
   * 获取本地IP地址
   */
  private getLocalIpAddresses(): { ipv4: string[], ipv6: string[] } {
    const interfaces = os.networkInterfaces()
    const ipv4: string[] = []
    const ipv6: string[] = []
    
    for (const name of Object.keys(interfaces)) {
      const networkInterface = interfaces[name]
      if (!networkInterface) continue
      
      for (const net of networkInterface) {
        // 跳过内部地址和非活跃接口
        if (net.internal || !net.address) continue
        
        if (net.family === 'IPv4') {
          ipv4.push(net.address)
        } else if (net.family === 'IPv6') {
          // 过滤掉链路本地地址
          if (!net.address.startsWith('fe80:')) {
            ipv6.push(net.address)
          }
        }
      }
    }
    
    return { ipv4, ipv6 }
  }

  /**
   * 获取系统基本信息
   */
  public async getSystemInfo(): Promise<SystemInfo> {
    const cpus = os.cpus()
    let platformName: string = os.platform()
    
    // 如果是Windows系统，获取具体版本信息
    if (os.platform() === 'win32') {
      try {
        // 使用PowerShell获取Windows版本信息，避免中文编码问题
        const { stdout } = await execAsync('powershell "(Get-WmiObject -Class Win32_OperatingSystem).Caption"', { encoding: 'utf8' })
        const versionName = stdout.trim()
        if (versionName && versionName !== '') {
          // 简化版本名称显示
          if (versionName.includes('Windows 11')) {
            platformName = 'Windows 11'
          } else if (versionName.includes('Windows 10')) {
            platformName = 'Windows 10'
          } else if (versionName.includes('Windows Server 2022')) {
            platformName = 'Windows Server 2022'
          } else if (versionName.includes('Windows Server 2019')) {
            platformName = 'Windows Server 2019'
          } else if (versionName.includes('Windows Server 2016')) {
            platformName = 'Windows Server 2016'
          } else if (versionName.includes('Windows Server')) {
            platformName = 'Windows Server'
          } else {
            platformName = 'Windows'
          }
        } else {
          platformName = 'Windows'
        }
      } catch (error) {
        this.logger.warn('获取Windows版本信息失败:', error)
        platformName = 'Windows'
      }
    }
    
    // 获取本地IP地址
    const { ipv4, ipv6 } = this.getLocalIpAddresses()
    
    return {
      platform: platformName,
      arch: os.arch(),
      hostname: os.hostname(),
      ipv4,
      ipv6,
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      nodeVersion: process.version,
      serverVersion: process.env.npm_package_version || '1.0.0',
      serverUptime: Date.now() - this.serverStartTime.getTime()
    }
  }

  /**
   * 收集系统统计信息
   */
  private async collectSystemStats(): Promise<SystemStats> {
    const cpuUsage = await this.getCpuUsage()
    const memoryInfo = this.getMemoryInfo()
    const diskInfo = await this.getDiskInfo()
    const networkInfo = await this.getNetworkInfo()
    const processInfo = await this.getProcessInfo()
    const loadInfo = this.getLoadInfo()
    
    return {
      timestamp: new Date(),
      cpu: cpuUsage,
      memory: memoryInfo,
      disk: diskInfo,
      network: networkInfo,
      processes: processInfo,
      load: loadInfo
    }
  }

  /**
   * 获取CPU使用率
   */
  private async getCpuUsage(): Promise<SystemStats['cpu']> {
    return new Promise((resolve) => {
      const cpus = os.cpus()
      const startMeasure = cpus.map(cpu => {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
        const idle = cpu.times.idle
        return { total, idle }
      })
      
      setTimeout(() => {
        const endMeasure = os.cpus().map(cpu => {
          const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0)
          const idle = cpu.times.idle
          return { total, idle }
        })
        
        let totalUsage = 0
        for (let i = 0; i < startMeasure.length; i++) {
          const totalDiff = endMeasure[i].total - startMeasure[i].total
          const idleDiff = endMeasure[i].idle - startMeasure[i].idle
          const usage = 100 - (100 * idleDiff / totalDiff)
          totalUsage += usage
        }
        
        const avgUsage = totalUsage / cpus.length
        
        resolve({
          usage: Math.round(avgUsage * 100) / 100,
          cores: cpus.length,
          model: cpus[0]?.model || 'Unknown',
          speed: cpus[0]?.speed || 0
        })
      }, 100)
    })
  }

  /**
   * 获取内存信息
   */
  private getMemoryInfo(): SystemStats['memory'] {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free
    const usage = (used / total) * 100
    
    return {
      total,
      used,
      free,
      usage: Math.round(usage * 100) / 100
    }
  }

  /**
   * 获取磁盘信息
   */
  private async getDiskInfo(): Promise<SystemStats['disk']> {
    try {
      if (os.platform() === 'win32') {
        return await this.getWindowsDiskInfo()
      } else {
        return await this.getLinuxDiskInfo()
      }
    } catch (error) {
      this.logger.error('获取磁盘信息失败:', error)
      return {
        total: 0,
        used: 0,
        free: 0,
        usage: 0
      }
    }
  }

  /**
   * 获取Windows磁盘信息
   */
  private async getWindowsDiskInfo(): Promise<SystemStats['disk']> {
    try {
      // 首先尝试使用wmic命令
      const command = 'wmic logicaldisk get size,freespace,caption'
      const { stdout } = await execAsync(command, { timeout: 10000 })
      
      const lines = stdout.trim().split('\n').slice(1)
      let totalSize = 0
      let totalFree = 0
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3) {
          const size = parseInt(parts[2]) || 0
          const free = parseInt(parts[1]) || 0
          totalSize += size
          totalFree += free
        }
      }
      
      const used = totalSize - totalFree
      const usage = totalSize > 0 ? (used / totalSize) * 100 : 0
      
      return {
        total: totalSize,
        used,
        free: totalFree,
        usage: Math.round(usage * 100) / 100
      }
    } catch (wmicError) {
      this.logger.warn('wmic命令执行失败，尝试使用备用方案:', wmicError)
      
      try {
        // 备用方案1: 使用PowerShell
        const psCommand = 'powershell "Get-WmiObject -Class Win32_LogicalDisk | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"'
        const { stdout } = await execAsync(psCommand, { timeout: 15000 })
        
        const disks = JSON.parse(stdout)
        const diskArray = Array.isArray(disks) ? disks : [disks]
        
        let totalSize = 0
        let totalFree = 0
        
        for (const disk of diskArray) {
          if (disk.Size && disk.FreeSpace) {
            totalSize += parseInt(disk.Size) || 0
            totalFree += parseInt(disk.FreeSpace) || 0
          }
        }
        
        const used = totalSize - totalFree
        const usage = totalSize > 0 ? (used / totalSize) * 100 : 0
        
        return {
          total: totalSize,
          used,
          free: totalFree,
          usage: Math.round(usage * 100) / 100
        }
      } catch (psError) {
        this.logger.warn('PowerShell命令执行失败，使用Node.js备用方案:', psError)
        
        // 备用方案2: 使用Node.js fs.statSync (仅获取主要驱动器信息)
        try {
          const drives = ['C:', 'D:', 'E:', 'F:', 'G:']
          let totalSize = 0
          let totalFree = 0
          
          for (const drive of drives) {
            try {
              const stats = await fs.stat(drive + '\\')
              // 注意：fs.stat无法直接获取磁盘空间信息
              // 这里只是一个占位符，实际需要其他方法
            } catch (driveError) {
              // 驱动器不存在，跳过
            }
          }
          
          // 如果所有方法都失败，返回默认值
          this.logger.warn('所有磁盘信息获取方法都失败，返回默认值')
          return {
            total: 0,
            used: 0,
            free: 0,
            usage: 0
          }
        } catch (nodeError) {
          throw nodeError
        }
      }
    }
  }

  /**
   * 获取Linux磁盘信息
   */
  private async getLinuxDiskInfo(): Promise<SystemStats['disk']> {
    const command = 'df -h /'
    const { stdout } = await execAsync(command, { timeout: 10000 })
    
    const lines = stdout.trim().split('\n')
    const dataLine = lines[1]
    const parts = dataLine.split(/\s+/)
    
    const total = this.parseSize(parts[1])
    const used = this.parseSize(parts[2])
    const free = this.parseSize(parts[3])
    const usage = parseFloat(parts[4].replace('%', ''))
    
    return {
      total,
      used,
      free,
      usage
    }
  }

  /**
   * 获取网络信息
   */
  private async getNetworkInfo(): Promise<SystemStats['network']> {
    try {
      let command: string
      
      if (os.platform() === 'win32') {
        command = 'typeperf "\\Network Interface(*)\\Bytes Total/sec" -sc 1'
      } else {
        command = 'cat /proc/net/dev'
      }
      
      const { stdout } = await execAsync(command)
      
      // 简化的网络统计，实际实现需要更复杂的解析
      const currentStats = {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      }
      
      if (this.lastNetworkStats) {
        return {
          bytesIn: Math.max(0, currentStats.bytesIn - this.lastNetworkStats.bytesIn),
          bytesOut: Math.max(0, currentStats.bytesOut - this.lastNetworkStats.bytesOut),
          packetsIn: Math.max(0, currentStats.packetsIn - this.lastNetworkStats.packetsIn),
          packetsOut: Math.max(0, currentStats.packetsOut - this.lastNetworkStats.packetsOut)
        }
      }
      
      this.lastNetworkStats = currentStats
      return currentStats
      
    } catch (error) {
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      }
    }
  }

  /**
   * 获取进程信息
   */
  private async getProcessInfo(): Promise<SystemStats['processes']> {
    try {
      let command: string
      
      if (os.platform() === 'win32') {
        command = 'tasklist /fo csv | find /c /v ""'
      } else {
        command = 'ps aux | wc -l'
      }
      
      const { stdout } = await execAsync(command)
      const total = parseInt(stdout.trim()) || 0
      
      return {
        total,
        running: Math.floor(total * 0.1), // 估算
        sleeping: Math.floor(total * 0.9) // 估算
      }
    } catch (error) {
      return {
        total: 0,
        running: 0,
        sleeping: 0
      }
    }
  }

  /**
   * 获取系统负载信息
   */
  private getLoadInfo(): SystemStats['load'] {
    try {
      const loadavg = os.loadavg()
      return {
        avg1: Math.round(loadavg[0] * 100) / 100,
        avg5: Math.round(loadavg[1] * 100) / 100,
        avg15: Math.round(loadavg[2] * 100) / 100
      }
    } catch (error) {
      return {
        avg1: 0,
        avg5: 0,
        avg15: 0
      }
    }
  }

  /**
   * 获取网络接口信息
   */
  public getNetworkInterfaces(): NetworkInterface[] {
    const interfaces = os.networkInterfaces()
    const result: NetworkInterface[] = []
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses) {
        for (const addr of addresses) {
          result.push({
            name,
            address: addr.address,
            netmask: addr.netmask,
            family: addr.family,
            mac: addr.mac,
            internal: addr.internal,
            cidr: addr.cidr || ''
          })
        }
      }
    }
    
    return result
  }

  /**
   * 获取磁盘信息列表
   */
  public async getDiskList(): Promise<DiskInfo[]> {
    try {
      if (os.platform() === 'win32') {
        return await this.getWindowsDiskList()
      } else {
        return await this.getLinuxDiskList()
      }
    } catch (error) {
      this.logger.error('获取磁盘列表失败:', error)
      return []
    }
  }

  /**
   * 获取Windows磁盘列表
   */
  private async getWindowsDiskList(): Promise<DiskInfo[]> {
    try {
      // 首先尝试使用wmic命令
      const command = 'wmic logicaldisk get size,freespace,caption'
      const { stdout } = await execAsync(command, { timeout: 10000 })
      
      const lines = stdout.trim().split('\n').slice(1)
      const disks: DiskInfo[] = []
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3) {
          const caption = parts[0]
          const freeSpace = parseInt(parts[1]) || 0
          const size = parseInt(parts[2]) || 0
          const used = size - freeSpace
          const usage = size > 0 ? (used / size) * 100 : 0
          
          disks.push({
            filesystem: caption,
            size,
            used,
            available: freeSpace,
            usage: Math.round(usage * 100) / 100,
            mountpoint: caption
          })
        }
      }
      
      return disks
    } catch (wmicError) {
      this.logger.warn('wmic命令执行失败，尝试使用PowerShell备用方案:', wmicError)
      
      try {
        // 备用方案: 使用PowerShell
        const psCommand = 'powershell "Get-WmiObject -Class Win32_LogicalDisk | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"'
        const { stdout } = await execAsync(psCommand, { timeout: 15000 })
        
        const diskData = JSON.parse(stdout)
        const diskArray = Array.isArray(diskData) ? diskData : [diskData]
        const disks: DiskInfo[] = []
        
        for (const disk of diskArray) {
          if (disk.Size && disk.FreeSpace) {
            const size = parseInt(disk.Size) || 0
            const freeSpace = parseInt(disk.FreeSpace) || 0
            const used = size - freeSpace
            const usage = size > 0 ? (used / size) * 100 : 0
            
            disks.push({
              filesystem: disk.DeviceID,
              size,
              used,
              available: freeSpace,
              usage: Math.round(usage * 100) / 100,
              mountpoint: disk.DeviceID
            })
          }
        }
        
        return disks
      } catch (psError) {
        this.logger.error('PowerShell命令也执行失败:', psError)
        throw psError
      }
    }
  }

  /**
   * 获取Linux磁盘列表
   */
  private async getLinuxDiskList(): Promise<DiskInfo[]> {
    const command = 'df -h'
    const { stdout } = await execAsync(command, { timeout: 10000 })
    
    const result: DiskInfo[] = []
    const lines = stdout.trim().split('\n').slice(1)
    
    for (const line of lines) {
      const parts = line.split(/\s+/)
      if (parts.length >= 6) {
        result.push({
          filesystem: parts[0],
          size: this.parseSize(parts[1]),
          used: this.parseSize(parts[2]),
          available: this.parseSize(parts[3]),
          usage: parseFloat(parts[4].replace('%', '')),
          mountpoint: parts[5]
        })
      }
    }
    
    return result
  }

  /**
   * 获取进程列表
   */
  public async getProcessList(): Promise<ProcessInfoResponse[]> {
    try {
      let processes: ProcessInfo[]
      if (os.platform() === 'win32') {
        processes = await this.getWindowsProcessList()
      } else {
        processes = await this.getLinuxProcessList()
      }
      
      // 转换数据格式以匹配客户端期望的格式
      return processes.map(process => ({
        id: `${process.pid}`, // 添加 id 字段
        pid: process.pid,
        name: process.name,
        cpu: process.cpu,
        memory: process.memory,
        status: process.status,
        startTime: process.startTime.toISOString(), // 转换为 ISO 字符串
        command: process.command
      }))
    } catch (error) {
      this.logger.error('获取进程列表失败:', error)
      return []
    }
  }

  /**
   * 获取Windows进程列表
   */
  private async getWindowsProcessList(): Promise<ProcessInfo[]> {
    // 使用 wmic 获取更详细的进程信息
    const command = 'wmic process get Name,ProcessId,PageFileUsage,UserModeTime,KernelModeTime,CreationDate /format:csv'
    const { stdout } = await execAsync(command, { timeout: 15000 })
    
    const result: ProcessInfo[] = []
    const lines = stdout.trim().split('\n').filter(line => line.trim() && !line.startsWith('Node'))
    
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const parts = line.split(',')
      if (parts.length >= 6) {
        const creationDate = parts[1]
        const kernelModeTime = parts[2] || '0'
        const name = parts[3] || 'Unknown'
        const pageFileUsage = parts[4] || '0'
        const processId = parts[5] || '0'
        const userModeTime = parts[6] || '0'
        
        const pid = parseInt(processId)
        if (pid && pid > 0 && name !== 'Unknown') {
          // 计算CPU使用率 (简化计算)
          const totalTime = parseInt(kernelModeTime) + parseInt(userModeTime)
          const cpu = totalTime > 0 ? Math.min(totalTime / 10000000, 100) : 0
          
          // 内存使用 (KB转MB)
          const memoryKB = parseInt(pageFileUsage) || 0
          const memoryMB = memoryKB / 1024
          
          // 解析创建时间
          let startTime = new Date()
          if (creationDate && creationDate.length >= 14) {
            try {
              const year = parseInt(creationDate.substring(0, 4))
              const month = parseInt(creationDate.substring(4, 6)) - 1
              const day = parseInt(creationDate.substring(6, 8))
              const hour = parseInt(creationDate.substring(8, 10))
              const minute = parseInt(creationDate.substring(10, 12))
              const second = parseInt(creationDate.substring(12, 14))
              startTime = new Date(year, month, day, hour, minute, second)
            } catch (e) {
              // 使用默认时间
            }
          }
          
          result.push({
            pid,
            name: name.replace('.exe', ''),
            cpu: Math.round(cpu * 100) / 100,
            memory: Math.round(memoryMB * 100) / 100, // 数字类型，单位MB
            status: 'Running',
            startTime: startTime, // Date 对象
            command: name
          })
        }
      }
    }
    
    // 按CPU使用率排序
    return result.sort((a, b) => b.cpu - a.cpu).slice(0, 50)
  }

  /**
   * 获取Linux进程列表
   */
  private async getLinuxProcessList(): Promise<ProcessInfo[]> {
    const command = 'ps aux --sort=-%cpu | head -51'
    const { stdout } = await execAsync(command, { timeout: 10000 })
    
    const result: ProcessInfo[] = []
    const lines = stdout.trim().split('\n').slice(1) // 跳过标题行
    
    for (const line of lines) {
      if (!line.trim()) continue
      
      // ps aux 输出格式: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 11) {
        const user = parts[0]
        const pid = parseInt(parts[1])
        const cpu = parseFloat(parts[2]) || 0
        const memPercent = parseFloat(parts[3]) || 0
        const vsz = parseInt(parts[4]) || 0
        const rss = parseInt(parts[5]) || 0
        const tty = parts[6]
        const stat = parts[7]
        const start = parts[8]
        const time = parts[9]
        const command = parts.slice(10).join(' ')
        
        if (pid && pid > 0) {
          // 内存使用 (KB转MB)
          const memoryMB = rss / 1024
          
          // 获取进程名 (从命令中提取)
          let processName = command.split(' ')[0]
          if (processName.includes('/')) {
            processName = processName.split('/').pop() || processName
          }
          
          // 状态映射
          let status = 'Running'
          if (stat.includes('Z')) status = 'Zombie'
          else if (stat.includes('T')) status = 'Stopped'
          else if (stat.includes('S')) status = 'Sleeping'
          
          // 解析启动时间
          let startTime = new Date()
          if (start && start !== '?') {
            try {
              // 如果是今天的时间格式 (HH:MM)
              if (start.includes(':')) {
                const [hour, minute] = start.split(':').map(Number)
                const today = new Date()
                startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute)
              } else {
                // 如果是日期格式 (MMM DD 或 YYYY)
                const today = new Date()
                if (start.length === 4 && !isNaN(Number(start))) {
                  // 年份格式
                  startTime = new Date(Number(start), 0, 1)
                } else {
                  // 月日格式，假设是今年
                  startTime = new Date(`${start} ${today.getFullYear()}`)
                }
              }
            } catch (e) {
              // 解析失败，使用当前时间
              startTime = new Date()
            }
          }
          
          result.push({
            pid,
            name: processName,
            cpu: Math.round(cpu * 100) / 100,
            memory: Math.round(memoryMB * 100) / 100, // 数字类型，单位MB
            status,
            startTime: startTime, // Date 对象
            command: command.length > 50 ? command.substring(0, 50) + '...' : command
          })
        }
      }
    }
    
    return result.slice(0, 50)
  }

  /**
   * 终止进程
   */
  public async killProcess(pid: number, force: boolean = false): Promise<{ success: boolean; message: string }> {
    try {
      if (!pid || pid <= 0) {
        return { success: false, message: '无效的进程ID' }
      }

      // 检查进程是否存在
      const processExists = await this.checkProcessExists(pid)
      if (!processExists) {
        return { success: false, message: '进程不存在或已经结束' }
      }

      let command: string
      
      if (os.platform() === 'win32') {
        // Windows: 使用 taskkill 命令
        if (force) {
          command = `taskkill /F /PID ${pid}`
        } else {
          command = `taskkill /PID ${pid}`
        }
      } else {
        // Linux/Unix: 使用 kill 命令
        if (force) {
          command = `kill -9 ${pid}`
        } else {
          command = `kill -15 ${pid}`
        }
      }
      
      this.logger.info(`尝试终止进程 PID: ${pid}, 强制: ${force}, 命令: ${command}`)
      
      const { stdout, stderr } = await execAsync(command)
      
      // 等待一小段时间后检查进程是否真的被终止
      await new Promise(resolve => setTimeout(resolve, 1000))
      const stillExists = await this.checkProcessExists(pid)
      
      if (stillExists) {
        if (!force) {
          // 如果普通终止失败，尝试强制终止
          this.logger.warn(`进程 ${pid} 普通终止失败，尝试强制终止`)
          return await this.killProcess(pid, true)
        } else {
          return { success: false, message: '进程终止失败，可能权限不足或进程受保护' }
        }
      }
      
      this.logger.info(`进程 ${pid} 已成功终止`)
      return { success: true, message: '进程已成功终止' }
      
    } catch (error: any) {
      this.logger.error(`终止进程 ${pid} 失败:`, error)
      
      // 解析错误信息
      let errorMessage = '终止进程失败'
      if (error.message) {
        if (error.message.includes('Access is denied') || error.message.includes('权限不足')) {
          errorMessage = '权限不足，无法终止该进程'
        } else if (error.message.includes('not found') || error.message.includes('No such process')) {
          errorMessage = '进程不存在'
        } else {
          errorMessage = `终止进程失败: ${error.message}`
        }
      }
      
      return { success: false, message: errorMessage }
    }
  }

  /**
   * 检查进程是否存在
   */
  private async checkProcessExists(pid: number): Promise<boolean> {
    try {
      let command: string
      
      if (os.platform() === 'win32') {
        command = `tasklist /FI "PID eq ${pid}" /FO CSV`
      } else {
        command = `ps -p ${pid}`
      }
      
      const { stdout } = await execAsync(command)
      
      if (os.platform() === 'win32') {
        // Windows: 检查输出是否包含进程信息
        const lines = stdout.trim().split('\n')
        return lines.length > 1 // 第一行是标题，如果有第二行说明进程存在
      } else {
        // Linux: ps 命令如果进程存在会返回进程信息
        return stdout.trim().split('\n').length > 1
      }
    } catch (error) {
      // 如果命令执行失败，通常说明进程不存在
      return false
    }
  }

  /**
   * 检查告警
   */
  private checkAlerts(stats: SystemStats): void {
    // CPU告警
    this.checkAlert('cpu', stats.cpu.usage, this.alertThresholds.cpu, 'CPU使用率')
    
    // 内存告警
    this.checkAlert('memory', stats.memory.usage, this.alertThresholds.memory, '内存使用率')
    
    // 磁盘告警
    this.checkAlert('disk', stats.disk.usage, this.alertThresholds.disk, '磁盘使用率')
  }

  /**
   * 检查单个指标告警
   */
  private checkAlert(
    type: SystemAlert['type'],
    value: number,
    thresholds: { warning: number; critical: number },
    description: string
  ): void {
    const alertId = `${type}-alert`
    const existingAlert = this.alerts.get(alertId)
    
    let level: SystemAlert['level'] | null = null
    
    if (value >= thresholds.critical) {
      level = 'critical'
    } else if (value >= thresholds.warning) {
      level = 'warning'
    }
    
    if (level) {
      if (!existingAlert || existingAlert.level !== level) {
        const alert: SystemAlert = {
          id: alertId,
          type,
          level,
          message: `${description}达到${level === 'critical' ? '严重' : '警告'}阈值`,
          value,
          threshold: level === 'critical' ? thresholds.critical : thresholds.warning,
          timestamp: new Date(),
          resolved: false
        }
        
        this.alerts.set(alertId, alert)
        this.io.emit('system-alert', alert)
        this.logger.warn(`系统告警: ${alert.message}, 当前值: ${value}%`)
      }
    } else if (existingAlert && !existingAlert.resolved) {
      // 告警解除
      existingAlert.resolved = true
      this.io.emit('system-alert-resolved', existingAlert)
      this.logger.info(`系统告警解除: ${existingAlert.message}`)
    }
  }

  /**
   * 获取统计历史
   */
  public getStatsHistory(minutes: number = 60): SystemStats[] {
    const pointsNeeded = Math.floor(minutes * 60 / 5) // 每5秒一个数据点
    return this.statsHistory.slice(-pointsNeeded)
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): SystemAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved)
  }

  /**
   * 设置告警阈值
   */
  public setAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds }
    this.logger.info('告警阈值已更新:', this.alertThresholds)
  }

  /**
   * 解析大小字符串（如 "1.5G" -> 字节数）
   */
  private parseSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    }
    
    const match = sizeStr.match(/^([0-9.]+)([KMGT]?)$/)
    if (!match) return 0
    
    const value = parseFloat(match[1])
    const unit = match[2] || ''
    
    return Math.floor(value * (units[unit] || 1))
  }

  /**
   * 获取活跃端口列表
   */
  public async getActivePorts(): Promise<ActivePort[]> {
    try {
      let command: string
      
      if (os.platform() === 'win32') {
        // Windows: 使用 netstat 命令
        command = 'netstat -ano'
      } else {
        // Linux/Unix: 使用 netstat 或 ss 命令
        command = 'netstat -tulpn 2>/dev/null || ss -tulpn'
      }
      
      const { stdout } = await execAsync(command)
      const result: ActivePort[] = []
      const lines = stdout.trim().split('\n')
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.includes('Proto') || trimmedLine.includes('Active')) {
          continue
        }
        
        if (os.platform() === 'win32') {
          // Windows netstat 输出格式解析
          const parts = trimmedLine.split(/\s+/)
          if (parts.length >= 4) {
            const protocol = parts[0].toLowerCase()
            const localAddress = parts[1]
            const state = parts[3] || 'UNKNOWN'
            const pid = parts[4] ? parseInt(parts[4]) : undefined
            
            // 解析地址和端口
            const addressMatch = localAddress.match(/^(.+):(\d+)$/)
            if (addressMatch) {
              const address = addressMatch[1] === '0.0.0.0' ? '所有接口' : addressMatch[1]
              const port = parseInt(addressMatch[2])
              
              if (port > 0 && (protocol === 'tcp' || protocol === 'udp')) {
                result.push({
                  port,
                  protocol: protocol as 'tcp' | 'udp',
                  state: state === 'LISTENING' ? '监听中' : state,
                  pid,
                  address
                })
              }
            }
          }
        } else {
          // Linux/Unix netstat/ss 输出格式解析
          const parts = trimmedLine.split(/\s+/)
          if (parts.length >= 4) {
            const protocol = parts[0].toLowerCase()
            const localAddress = parts[3] || parts[4] // netstat vs ss 格式差异
            const state = parts[5] || 'UNKNOWN'
            
            // 解析进程信息 (如果有)
            let processInfo = ''
            let pid: number | undefined
            const processMatch = trimmedLine.match(/(\d+)\/([^\s]+)/)
            if (processMatch) {
              pid = parseInt(processMatch[1])
              processInfo = processMatch[2]
            }
            
            // 解析地址和端口
            const addressMatch = localAddress.match(/^(.+?):(\d+)$/)
            if (addressMatch) {
              let address = addressMatch[1]
              if (address === '0.0.0.0' || address === '::') {
                address = '所有接口'
              } else if (address === '127.0.0.1' || address === '::1') {
                address = '本地回环'
              }
              
              const port = parseInt(addressMatch[2])
              
              if (port > 0 && (protocol.includes('tcp') || protocol.includes('udp'))) {
                const protocolType = protocol.includes('tcp') ? 'tcp' : 'udp'
                result.push({
                  port,
                  protocol: protocolType,
                  state: state === 'LISTEN' ? '监听中' : state,
                  process: processInfo || undefined,
                  pid,
                  address
                })
              }
            }
          }
        }
      }
      
      // 按端口号排序并去重
      const uniquePorts = new Map<string, ActivePort>()
      for (const port of result) {
        const key = `${port.protocol}-${port.port}-${port.address}`
        if (!uniquePorts.has(key)) {
          uniquePorts.set(key, port)
        }
      }
      
      return Array.from(uniquePorts.values()).sort((a, b) => a.port - b.port)
      
    } catch (error) {
      this.logger.error('获取活跃端口失败:', error)
      return []
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.logger.info('开始清理系统监控资源...')
    this.stopMonitoring()
    this.alerts.clear()
    this.statsHistory = []
    this.logger.info('系统监控资源已清理完成')
  }
}