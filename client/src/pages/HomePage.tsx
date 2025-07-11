import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { SystemStats, SystemInfo, ProcessInfo, WeatherData } from '@/types'
import socketClient from '@/utils/socket'
import apiClient from '@/utils/api'
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Server,
  Activity,
  Terminal,
  ArrowRight
} from 'lucide-react'
import MusicPlayer from '@/components/MusicPlayer'

// 城市代码映射
const cityOptions = [
  { value: '101010100', label: '北京市' },
  { value: '101020100', label: '上海市' },
  { value: '101280101', label: '广州市' },
  { value: '101280601', label: '深圳市' },
  { value: '101210101', label: '杭州市' },
  { value: '101030100', label: '天津市' },
  { value: '101200101', label: '武汉市' },
  { value: '101270101', label: '成都市' },
  { value: '101110101', label: '西安市' },
  { value: '101190401', label: '苏州市' },
  { value: '101230101', label: '福州市' },
  { value: '101040100', label: '重庆市' },
  { value: '101250101', label: '长沙市' },
  { value: '101230201', label: '厦门市' },
  { value: '101180101', label: '郑州市' },
  { value: '101120101', label: '济南市' },
  { value: '101190101', label: '南京市' },
  { value: '101260101', label: '合肥市' },
  { value: '101300101', label: '南宁市' },
  { value: '101310101', label: '海口市' },
  { value: '101320101', label: '石家庄市' },
  { value: '101330101', label: '太原市' },
  { value: '101340101', label: '沈阳市' },
  { value: '101050101', label: '哈尔滨市' },
  { value: '101060101', label: '长春市' },
  { value: '101070101', label: '呼和浩特市' },
  { value: '101080101', label: '乌鲁木齐市' },
  { value: '101090101', label: '银川市' },
  { value: '101100101', label: '西宁市' },
  { value: '101150101', label: '兰州市' },
  { value: '101160101', label: '拉萨市' },
  { value: '101240101', label: '南昌市' },
  { value: '101290101', label: '昆明市' },
  { value: '101170101', label: '贵阳市' }
]

const HomePage: React.FC = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [processList, setProcessList] = useState<ProcessInfo[]>([])
  const [connected, setConnected] = useState(socketClient.isConnected())
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  
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
    
    // 获取活跃终端进程列表
    const fetchTerminalProcesses = async () => {
      try {
        const response = await apiClient.getActiveTerminalProcesses()
        if (response.success) {
          setProcessList(response.data)
        }
      } catch (error) {
        console.error('获取终端进程列表失败:', error)
      }
    }
    
    fetchSystemInfo()
    fetchTerminalProcesses()
    
    // 设置定时刷新终端进程列表
    const processInterval = setInterval(fetchTerminalProcesses, 5000) // 每5秒刷新一次
    
    // 设置定时更新日期时间
    const dateTimeInterval = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000) // 每秒更新一次
    


    // 获取天气信息
    const fetchWeatherData = async () => {
      try {
        setWeatherLoading(true)
        
        // 从localStorage获取天气城市设置
        let weatherCity = '101010100' // 默认北京
        try {
          const webSettings = localStorage.getItem('webSettings')
          if (webSettings) {
            const settings = JSON.parse(webSettings)
            if (settings.weatherCity) {
              weatherCity = settings.weatherCity
            }
          }
        } catch (error) {
          console.warn('读取天气城市设置失败:', error)
        }
        
        const response = await fetch(`/api/weather/current?city=${weatherCity}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (result.success && result.data) {
          // 添加选择的城市代码到天气数据中
          setWeatherData({ ...result.data, selectedCityCode: weatherCity })
        } else {
          throw new Error('天气API返回错误数据')
        }
      } catch (error) {
        console.error('获取天气信息失败:', error)
        setWeatherData(null)
      } finally {
        setWeatherLoading(false)
      }
    }
    
    fetchWeatherData()
    // 每30分钟更新一次天气信息
    const weatherInterval = setInterval(fetchWeatherData, 30 * 60 * 1000)
    
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
      clearInterval(processInterval)
      clearInterval(dateTimeInterval)
      clearInterval(weatherInterval)
    }
  }, [])
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
  
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return {
      date: `${year}年${month}月${day}日`,
      time: `${hours}:${minutes}:${seconds}`
    }
  }

  return (
    <div className="space-y-6">
      {/* 日期时间和天气显示 */}
      <div className="card-game p-6">
        <div className="flex items-center justify-center space-x-8">
          {/* 日期时间 */}
          <div className="text-center">
            <div className="text-3xl font-bold text-black dark:text-white mb-2">
              {formatDateTime(currentDateTime).date}
            </div>
            <div className="text-4xl font-mono font-bold text-blue-600 dark:text-blue-400">
              {formatDateTime(currentDateTime).time}
            </div>
          </div>
          
          {/* 分隔线 */}
          <div className="h-20 w-px bg-gray-300 dark:bg-gray-600"></div>
          
          {/* 天气信息 */}
          <div className="text-center">
            {weatherLoading ? (
              <div className="text-gray-500 dark:text-gray-400">加载中...</div>
            ) : weatherData ? (
               <div>
                 <div className="text-2xl font-bold text-black dark:text-white mb-1">
                   {cityOptions.find(city => city.value === weatherData.selectedCityCode)?.label || weatherData.cityInfo?.city || '北京'}
                 </div>
                 <div className="flex items-center justify-center space-x-2 mb-2">
                   <span className="text-3xl font-bold text-orange-500">
                     {weatherData.wendu}°C
                   </span>
                   <span className="text-lg text-gray-600 dark:text-gray-400">
                     {weatherData.forecast?.[0]?.type || '晴'}
                   </span>
                 </div>
                 <div className="text-sm text-gray-500 dark:text-gray-400">
                   {weatherData.forecast?.[0]?.low?.replace('低温 ', '')} ~ {weatherData.forecast?.[0]?.high?.replace('高温 ', '')}
                 </div>
                 <div className="text-sm text-gray-500 dark:text-gray-400">
                   {weatherData.forecast?.[0]?.fx} {weatherData.forecast?.[0]?.fl}
                 </div>
                 <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                   湿度: {weatherData.shidu} | 空气质量: {weatherData.quality}
                 </div>
               </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400">天气信息获取失败</div>
            )}
          </div>
        </div>
      </div>
      
      {/* 欢迎信息 */}
      <div className="card-game p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black dark:text-white font-display mb-2">
              欢迎回来，{user?.username}！
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              GSManager3 游戏服务器管理面板 - 让游戏服务器管理变得简单

            </p>
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
          

        </div>
      )}
      
      {/* 终端占用和音乐播放器 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 终端占用模块 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Terminal className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-black dark:text-white">终端占用</h3>
            <span className="text-sm text-gray-600 dark:text-gray-400">({processList.length} 个进程)</span>
          </div>
          
          {processList.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
                <span>终端名称</span>
                <span>PID</span>
                <span>操作</span>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {processList.map((process, index) => (
                  <div key={`${process.id}-${index}`} className="grid grid-cols-3 gap-4 text-sm py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                    <span className="text-black dark:text-white font-medium truncate" title={process.name}>
                      {process.name}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">
                      {process.pid}
                    </span>
                    <button
                      onClick={() => navigate(`/terminal?sessionId=${process.id}`)}
                      className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      <span>前往终端</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无终端进程运行</p>
            </div>
          )}
        </div>
        
        {/* 音乐播放器 */}
        <MusicPlayer />
      </div>

    </div>
  )
}

export default HomePage