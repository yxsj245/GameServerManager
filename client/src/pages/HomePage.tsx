import React, { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { SystemStats, SystemInfo } from '@/types'
import socketClient from '@/utils/socket'
import apiClient from '@/utils/api'
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Clock,
  Server,
  Activity,
  Zap,
  Users,
  Terminal as TerminalIcon
} from 'lucide-react'

const HomePage: React.FC = () => {
  const { user } = useAuthStore()
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [connected, setConnected] = useState(socketClient.isConnected())
  
  useEffect(() => {
    // 获取系统信息
    const fetchSystemInfo = async () => {
      try {
        const response = await apiClient.getSystemInfo()
        if (response.success) {
          setSystemInfo(response.data)
        }
      } catch (error) {
        console.error('获取系统信息失败:', error)
      }
    }
    
    fetchSystemInfo()
    
    // 设置初始连接状态
    setConnected(socketClient.isConnected())
    
    // 监听Socket连接状态
    socketClient.on('connection-status', ({ connected }) => {
      setConnected(connected)
    })
    
    // 监听系统状态更新
    socketClient.on('system-stats', (stats: SystemStats) => {
      setSystemStats(stats)
    })
    
    // 订阅系统状态
    socketClient.subscribeSystemStats()
    
    return () => {
      socketClient.off('connection-status')
      socketClient.off('system-stats')
      socketClient.emit('unsubscribe-system-stats')
    }
  }, [])
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (days > 0) {
      return `${days}天 ${hours}小时 ${minutes}分钟`
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`
    } else {
      return `${minutes}分钟`
    }
  }
  
  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-red-500'
    if (usage >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }
  
  const getUsageBgColor = (usage: number) => {
    if (usage >= 90) return 'bg-red-500'
    if (usage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }
  
  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div className="card-game p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black dark:text-white font-display mb-2">
              欢迎回来，{user?.username}！
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              GSM3 游戏服务器管理面板 - 让游戏服务器管理变得简单
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {connected ? '已连接' : '连接中断'}
            </span>
          </div>
        </div>
      </div>
      
      {/* 系统信息卡片 */}
      {systemInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card-game p-6">
            <div className="flex items-center space-x-3">
              <Server className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">操作系统</p>
                <p className="text-lg font-semibold text-black dark:text-white">{systemInfo.platform}</p>
              </div>
            </div>
          </div>
          
          <div className="card-game p-6">
            <div className="flex items-center space-x-3">
              <Cpu className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">架构</p>
                <p className="text-lg font-semibold text-black dark:text-white">{systemInfo.arch}</p>
              </div>
            </div>
          </div>
          
          <div className="card-game p-6">
            <div className="flex items-center space-x-3">
              <Network className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">主机名</p>
                <p className="text-lg font-semibold text-black dark:text-white">{systemInfo.hostname}</p>
              </div>
            </div>
          </div>
          
          <div className="card-game p-6">
            <div className="flex items-center space-x-3">
              <Zap className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Node.js</p>
                <p className="text-lg font-semibold text-black dark:text-white">{systemInfo.nodeVersion}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 系统状态 */}
      {systemStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CPU使用率 */}
          <div className="card-game p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Cpu className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold text-black dark:text-white">CPU使用率</h3>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(systemStats.cpu.usage)}`}>
                {systemStats.cpu.usage.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>核心数: {systemStats.cpu.cores}</span>
                <span>型号: {systemStats.cpu.model}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageBgColor(systemStats.cpu.usage)}`}
                  style={{ width: `${systemStats.cpu.usage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* 内存使用率 */}
          <div className="card-game p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <MemoryStick className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-semibold text-black dark:text-white">内存使用率</h3>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(systemStats.memory.usage)}`}>
                {systemStats.memory.usage.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>已用: {formatBytes(systemStats.memory.used)}</span>
                <span>总计: {formatBytes(systemStats.memory.total)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageBgColor(systemStats.memory.usage)}`}
                  style={{ width: `${systemStats.memory.usage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* 磁盘使用率 */}
          <div className="card-game p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <HardDrive className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-semibold text-black dark:text-white">磁盘使用率</h3>
              </div>
              <span className={`text-2xl font-bold ${getUsageColor(systemStats.disk.usage)}`}>
                {systemStats.disk.usage.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>已用: {formatBytes(systemStats.disk.used)}</span>
                <span>总计: {formatBytes(systemStats.disk.total)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getUsageBgColor(systemStats.disk.usage)}`}
                  style={{ width: `${systemStats.disk.usage}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          {/* 系统运行时间 */}
          <div className="card-game p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Clock className="w-6 h-6 text-yellow-500" />
                <h3 className="text-lg font-semibold text-black dark:text-white">系统运行时间</h3>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-black dark:text-white">
                {formatUptime(systemStats.uptime)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                最后更新: {new Date(systemStats.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 快速操作 */}
      <div className="card-game p-6">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4 flex items-center space-x-2">
          <Activity className="w-5 h-5" />
          <span>快速操作</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-game flex items-center justify-center space-x-2 py-4">
            <TerminalIcon className="w-5 h-5" />
            <span>打开终端</span>
          </button>
          <button className="btn-game flex items-center justify-center space-x-2 py-4">
            <Server className="w-5 h-5" />
            <span>服务器状态</span>
          </button>
          <button className="btn-game flex items-center justify-center space-x-2 py-4">
            <Users className="w-5 h-5" />
            <span>用户管理</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default HomePage