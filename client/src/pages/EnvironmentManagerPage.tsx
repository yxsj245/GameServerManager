import React, { useState, useEffect } from 'react'
import { 
  Coffee, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Trash2, 
  RefreshCw,
  Monitor,
  Server,
  Loader2
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'
import socketClient from '@/utils/socket'

interface JavaEnvironment {
  version: string
  platform: string
  downloadUrl: string
  installed: boolean
  installPath?: string
  javaExecutable?: string
  installing?: boolean
  installProgress?: number
  installStage?: 'download' | 'extract'
}

interface SystemInfo {
  platform: string
  arch: string
}

const EnvironmentManagerPage: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [javaEnvironments, setJavaEnvironments] = useState<JavaEnvironment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('java')

  const { addNotification } = useNotificationStore()

  // Java版本配置
  const javaVersions = [
    {
      version: 'Java 8',
      key: 'java8',
      description: 'Java 8 (OpenJDK 8u44)',
      windows: 'https://download.java.net/openjdk/jdk8u44/ri/openjdk-8u44-windows-i586.zip',
      linux: 'https://download.java.net/openjdk/jdk8u44/ri/openjdk-8u44-linux-x64.tar.gz'
    },
    {
      version: 'Java 17',
      key: 'java17',
      description: 'Java 17 (OpenJDK 17.0.0.1)',
      windows: 'https://download.java.net/openjdk/jdk17.0.0.1/ri/openjdk-17.0.0.1+2_windows-x64_bin.zip',
      linux: 'https://download.java.net/openjdk/jdk17.0.0.1/ri/openjdk-17.0.0.1+2_linux-x64_bin.tar.gz'
    },
    {
      version: 'Java 21',
      key: 'java21',
      description: 'Java 21 (OpenJDK 21+35)',
      windows: 'https://download.java.net/openjdk/jdk21/ri/openjdk-21+35_windows-x64_bin.zip',
      linux: 'https://download.java.net/openjdk/jdk21/ri/openjdk-21+35_linux-x64_bin.tar.gz'
    }
  ]

  // 获取系统信息
  const fetchSystemInfo = async () => {
    try {
      const response = await apiClient.getEnvironmentSystemInfo()
      if (response.success && response.data) {
        setSystemInfo({
          platform: response.data.platform,
          arch: response.data.arch
        })
      }
    } catch (error) {
      console.error('获取系统信息失败:', error)
      addNotification({
        type: 'error',
        title: '错误',
        message: '获取系统信息失败'
      })
    }
  }

  // 获取Java环境列表
  const fetchJavaEnvironments = async () => {
    try {
      const response = await apiClient.getJavaEnvironments()
      if (response.success && response.data) {
        setJavaEnvironments(response.data)
      }
    } catch (error) {
      console.error('获取Java环境列表失败:', error)
      addNotification({
        type: 'error',
        title: '错误',
        message: '获取Java环境列表失败'
      })
    }
  }

  // 初始化数据
  useEffect(() => {
    const initData = async () => {
      setLoading(true)
      await Promise.all([fetchSystemInfo(), fetchJavaEnvironments()])
      setLoading(false)
    }
    initData()

    // 监听Java安装进度
    const handleInstallProgress = (data: { version: string; stage: 'download' | 'extract'; progress: number }) => {
      setJavaEnvironments(prev => prev.map(env =>
        env.version === data.version
          ? {
              ...env,
              installing: true,
              installStage: data.stage,
              installProgress: data.stage === 'download' ? data.progress * 0.7 : 70 + (data.progress * 0.3)
            }
          : env
      ))
    }

    // 监听Java安装完成
    const handleInstallComplete = (data: { version: string; success: boolean; message: string }) => {
      setJavaEnvironments(prev => prev.map(env =>
        env.version === data.version
          ? { ...env, installing: false, installProgress: 0, installStage: undefined }
          : env
      ))

      addNotification({
        type: data.success ? 'success' : 'error',
        title: data.success ? '成功' : '错误',
        message: data.message
      })

      if (data.success) {
        fetchJavaEnvironments()
      }
    }

    socketClient.on('java-install-progress', handleInstallProgress)
    socketClient.on('java-install-complete', handleInstallComplete)

    return () => {
      socketClient.off('java-install-progress', handleInstallProgress)
      socketClient.off('java-install-complete', handleInstallComplete)
    }
  }, [])

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchJavaEnvironments()
    setRefreshing(false)
  }

  // 安装Java环境
  const handleInstallJava = async (version: string) => {
    if (!systemInfo) {
      addNotification({
        type: 'error',
        title: '错误',
        message: '系统信息未加载'
      })
      return
    }

    const javaConfig = javaVersions.find(v => v.key === version)
    if (!javaConfig) {
      addNotification({
        type: 'error',
        title: '错误',
        message: '未找到Java版本配置'
      })
      return
    }

    const downloadUrl = systemInfo.platform === 'win32' ? javaConfig.windows : javaConfig.linux

    try {
      // 更新安装状态
      setJavaEnvironments(prev => prev.map(env =>
        env.version === version
          ? { ...env, installing: true, installProgress: 0 }
          : env
      ))

      const response = await apiClient.installJavaEnvironment({
        version,
        downloadUrl,
        platform: systemInfo.platform,
        socketId: socketClient.getId()
      })

      if (!response.success) {
        addNotification({
          type: 'error',
          title: '错误',
          message: `${javaConfig.version} 启动安装失败: ${response.message}`
        })
        // 重置安装状态
        setJavaEnvironments(prev => prev.map(env =>
          env.version === version
            ? { ...env, installing: false, installProgress: 0 }
            : env
        ))
      }
    } catch (error) {
      console.error('安装Java环境失败:', error)
      addNotification({
        type: 'error',
        title: '错误',
        message: `${javaConfig.version} 安装失败`
      })
      // 重置安装状态
      setJavaEnvironments(prev => prev.map(env =>
        env.version === version
          ? { ...env, installing: false, installProgress: 0 }
          : env
      ))
    }
  }

  // 卸载Java环境
  const handleUninstallJava = async (version: string) => {
    try {
      const response = await apiClient.uninstallJavaEnvironment(version)
      if (response.success) {
        addNotification({
          type: 'success',
          title: '成功',
          message: `${version} 卸载成功`
        })
        await fetchJavaEnvironments()
      } else {
        addNotification({
          type: 'error',
          title: '错误',
          message: `${version} 卸载失败: ${response.message}`
        })
      }
    } catch (error) {
      console.error('卸载Java环境失败:', error)
      addNotification({
        type: 'error',
        title: '错误',
        message: `${version} 卸载失败`
      })
    }
  }

  // 复制Java路径
  const handleCopyJavaPath = (javaExecutable: string) => {
    navigator.clipboard.writeText(javaExecutable).then(() => {
      addNotification({
        type: 'success',
        title: '成功',
        message: 'Java路径已复制到剪贴板'
      })
    }).catch(() => {
      addNotification({
        type: 'error',
        title: '错误',
        message: '复制失败'
      })
    })
  }

  // 获取平台图标
  const getPlatformIcon = () => {
    if (!systemInfo) return <Monitor className="w-4 h-4" />
    return systemInfo.platform === 'win32' 
      ? <Monitor className="w-4 h-4" />
      : <Server className="w-4 h-4" />
  }

  // 获取平台名称
  const getPlatformName = () => {
    if (!systemInfo) return '未知'
    return systemInfo.platform === 'win32' ? 'Windows' : 'Linux'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">正在加载环境信息...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Coffee className="w-6 h-6 mr-2 text-orange-500" />
            环境管理
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">管理和安装各种开发环境</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>刷新</span>
        </button>
      </div>

      {/* 系统信息 */}
      {systemInfo && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            {getPlatformIcon()}
            <span className="text-blue-800 dark:text-blue-200">
              当前系统: {getPlatformName()} ({systemInfo.arch})
            </span>
          </div>
        </div>
      )}

      {/* 环境管理标签页 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        {/* 标签页头部 */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('java')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'java'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Coffee className="w-4 h-4" />
                <span>Java 环境</span>
              </div>
            </button>
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="p-6">
          {activeTab === 'java' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {javaVersions.map((javaConfig) => {
                const env = javaEnvironments.find(e => e.version === javaConfig.key)
                const isInstalled = env?.installed || false
                const isInstalling = env?.installing || false
                
                return (
                  <div
                    key={javaConfig.key}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600"
                  >
                    {/* 卡片头部 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Coffee className="w-5 h-5 text-orange-500" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {javaConfig.version}
                        </h3>
                      </div>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                        isInstalled 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {isInstalled ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>已安装</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            <span>未安装</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 描述 */}
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {javaConfig.description}
                    </p>

                    {/* 安装进度 */}
                    {isInstalling && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span>
                            {env?.installStage === 'download' ? '正在下载...' :
                             env?.installStage === 'extract' ? '正在解压...' : '正在安装...'}
                          </span>
                          <span>{Math.round(env?.installProgress || 0)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${env?.installProgress || 0}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {env?.installStage === 'download' ? '下载阶段 (70%)' :
                           env?.installStage === 'extract' ? '解压阶段 (30%)' : ''}
                        </div>
                      </div>
                    )}

                    {/* Java路径 */}
                    {isInstalled && env?.javaExecutable && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">启动命令:</p>
                        <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border text-xs font-mono break-all">
                          {env.javaExecutable}
                        </div>
                        <button
                          onClick={() => handleCopyJavaPath(env.javaExecutable!)}
                          className="mt-2 flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Copy className="w-3 h-3" />
                          <span>复制路径</span>
                        </button>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex space-x-2">
                      {!isInstalled ? (
                        <button
                          onClick={() => handleInstallJava(javaConfig.key)}
                          disabled={isInstalling}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                        >
                          {isInstalling ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>安装中...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>安装</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUninstallJava(javaConfig.key)}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>卸载</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EnvironmentManagerPage
