import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Server,
  ExternalLink,
  FolderOpen,
  Play,
  X,
  Loader,
  Pickaxe,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'
import { MinecraftServerCategory, MinecraftDownloadOptions, MinecraftDownloadProgress } from '@/types'

interface GameInfo {
  game_nameCN: string
  appid: string
  tip: string
  image: string
  url: string
}

interface Games {
  [key: string]: GameInfo
}



const GameDeploymentPage: React.FC = () => {
  const { addNotification } = useNotificationStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('steamcmd')
  const [games, setGames] = useState<Games>({})
  const [loading, setLoading] = useState(true)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [selectedGame, setSelectedGame] = useState<{ key: string; info: GameInfo } | null>(null)
  const [installPath, setInstallPath] = useState('')
  const [instanceName, setInstanceName] = useState('')
  const [installing, setInstalling] = useState(false)
  const [useAnonymous, setUseAnonymous] = useState(true)
  const [steamUsername, setSteamUsername] = useState('')
  const [steamPassword, setSteamPassword] = useState('')

  // Minecraft相关状态
  const [minecraftCategories, setMinecraftCategories] = useState<MinecraftServerCategory[]>([])
  const [minecraftLoading, setMinecraftLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [availableVersions, setAvailableVersions] = useState<string[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [minecraftInstallPath, setMinecraftInstallPath] = useState('')
  const [skipJavaCheck, setSkipJavaCheck] = useState(false)
  const [skipServerRun, setSkipServerRun] = useState(false)
  const [minecraftDownloading, setMinecraftDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<MinecraftDownloadProgress | null>(null)
  const [javaValidated, setJavaValidated] = useState<boolean | null>(null)

  // 获取游戏列表
  const fetchGames = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getInstallableGames()
      
      if (response.success) {
        setGames(response.data || {})
      } else {
        throw new Error(response.message || '获取游戏列表失败')
      }
    } catch (error: any) {
      console.error('获取游戏列表失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: error.message || '无法获取游戏列表'
      })
    } finally {
      setLoading(false)
    }
  }

  // 获取Minecraft服务器分类
  const fetchMinecraftCategories = async () => {
    try {
      setMinecraftLoading(true)
      const response = await apiClient.getMinecraftServerCategories()
      
      if (response.success) {
        setMinecraftCategories(response.data || [])
      } else {
        throw new Error(response.message || '获取Minecraft服务器分类失败')
      }
    } catch (error: any) {
      console.error('获取Minecraft服务器分类失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: error.message || '无法获取Minecraft服务器分类'
      })
    } finally {
      setMinecraftLoading(false)
    }
  }

  // 获取指定服务端的可用版本
  const fetchMinecraftVersions = async (server: string) => {
    try {
      const response = await apiClient.getMinecraftVersions(server)
      
      if (response.success) {
        setAvailableVersions(response.data || [])
        setSelectedVersion('')
      } else {
        throw new Error(response.message || '获取版本列表失败')
      }
    } catch (error: any) {
      console.error('获取版本列表失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: error.message || '无法获取版本列表'
      })
    }
  }

  // 验证Java环境
  const validateJava = async () => {
    try {
      const response = await apiClient.validateJavaEnvironment()
      setJavaValidated(response.success)
      
      if (!response.success) {
        addNotification({
          type: 'warning',
          title: 'Java环境检查',
          message: 'Java环境验证失败，请确保已安装Java并添加到PATH环境变量中'
        })
      }
    } catch (error: any) {
      console.error('Java环境验证失败:', error)
      setJavaValidated(false)
    }
  }

  // 下载Minecraft服务端
  const downloadMinecraftServer = async () => {
    if (!selectedServer || !selectedVersion || !minecraftInstallPath.trim()) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请选择服务端、版本并填写安装路径'
      })
      return
    }

    try {
      setMinecraftDownloading(true)
      setDownloadProgress(null)
      
      const downloadOptions: MinecraftDownloadOptions = {
        server: selectedServer,
        version: selectedVersion,
        targetDirectory: minecraftInstallPath.trim(),
        skipJavaCheck,
        skipServerRun
      }
      
      const response = await apiClient.downloadMinecraftServer(downloadOptions)
      
      if (response.success) {
        addNotification({
          type: 'success',
          title: '下载完成',
          message: `${selectedServer} ${selectedVersion} 下载完成！`
        })
        
        // 重置表单
        setSelectedCategory('')
        setSelectedServer('')
        setSelectedVersion('')
        setMinecraftInstallPath('')
        setAvailableVersions([])
      } else {
        throw new Error(response.message || '下载失败')
      }
    } catch (error: any) {
      console.error('Minecraft服务端下载失败:', error)
      addNotification({
        type: 'error',
        title: '下载失败',
        message: error.message || '无法下载Minecraft服务端'
      })
    } finally {
      setMinecraftDownloading(false)
      setDownloadProgress(null)
    }
  }

  // 处理服务端选择
  const handleServerSelect = (server: string) => {
    setSelectedServer(server)
    setSelectedVersion('')
    setAvailableVersions([])
    fetchMinecraftVersions(server)
  }

  useEffect(() => {
    fetchGames()
    if (activeTab === 'minecraft') {
      fetchMinecraftCategories()
      validateJava()
    }
  }, [activeTab])

  // 打开安装对话框
  const handleInstallGame = (gameKey: string, gameInfo: GameInfo) => {
    setSelectedGame({ key: gameKey, info: gameInfo })
    setInstanceName(gameInfo.game_nameCN)
    setInstallPath('')
    setShowInstallModal(true)
  }

  // 开始安装游戏
  const startInstallation = async () => {
    if (!selectedGame || !installPath.trim() || !instanceName.trim()) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请填写完整的安装信息'
      })
      return
    }

    if (!useAnonymous && (!steamUsername.trim() || !steamPassword.trim())) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请填写Steam账户信息'
      })
      return
    }

    try {
      // 构建SteamCMD安装命令
      const loginCommand = useAnonymous 
        ? 'login anonymous'
        : `login ${steamUsername.trim()} ${steamPassword.trim()}`
      
      const installCommand = `force_install_dir "${installPath.trim()}" +app_update ${selectedGame.info.appid}`
      
      const fullCommand = `steamcmd +${loginCommand} +${installCommand} +quit`
      
      // 关闭对话框
      setShowInstallModal(false)
      
      // 调用后端API开始游戏安装
       const response = await apiClient.installGame({
          gameKey: selectedGame.key,
          gameName: selectedGame.info.game_nameCN,
          appId: selectedGame.info.appid,
          installPath: installPath.trim(),
          instanceName: instanceName.trim(),
          useAnonymous,
          steamUsername: useAnonymous ? undefined : steamUsername.trim(),
          steamPassword: useAnonymous ? undefined : steamPassword.trim(),
          steamcmdCommand: fullCommand
        })
      
      if (response.success) {
        addNotification({
          type: 'success',
          title: '安装已启动',
          message: `${selectedGame.info.game_nameCN} 安装已开始，请前往终端页面查看安装进度`
        })
      } else {
        throw new Error(response.message || '安装失败')
      }
    } catch (error: any) {
      console.error('游戏安装失败:', error)
      addNotification({
        type: 'error',
        title: '安装失败',
        message: error.message || '无法开始游戏安装'
      })
    }
  }

  // 选择安装路径
  const selectInstallPath = async () => {
    try {
      // 这里可以集成文件选择器，暂时使用输入框
      const path = prompt('请输入安装路径:', 'D:\\Games\\' + selectedGame?.info.game_nameCN)
      if (path) {
        setInstallPath(path)
      }
    } catch (error) {
      console.error('选择路径失败:', error)
    }
  }

  const tabs = [
    { id: 'steamcmd', name: 'SteamCMD', icon: Download },
    { id: 'minecraft', name: 'Minecraft部署', icon: Pickaxe }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">加载游戏列表中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">游戏部署</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            快速部署各种游戏服务器
          </p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* SteamCMD 标签页内容 */}
      {activeTab === 'steamcmd' && (
        <div className="space-y-6">
          {/* 游戏网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Object.entries(games).map(([gameKey, gameInfo]) => (
              <div
                key={gameKey}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* 游戏图片 */}
                <div className="aspect-video bg-gray-200 dark:bg-gray-700 relative">
                  <img
                    src={gameInfo.image}
                    alt={gameInfo.game_nameCN}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuaXoOazleWKoOi9veWbvueJhzwvdGV4dD48L3N2Zz4='
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <a
                      href={gameInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-black/50 text-white p-1 rounded hover:bg-black/70 transition-colors"
                      title="查看Steam商店页面"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* 游戏信息 */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-center">
                    {gameInfo.game_nameCN}
                  </h3>

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleInstallGame(gameKey, gameInfo)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>安装游戏</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minecraft 标签页内容 */}
      {activeTab === 'minecraft' && (
        <div className="space-y-6">
          {/* Java环境状态 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="flex items-center space-x-3">
              {javaValidated === null ? (
                <Loader className="w-5 h-5 animate-spin text-blue-500" />
              ) : javaValidated ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Java环境状态
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {javaValidated === null
                    ? '检查中...'
                    : javaValidated
                    ? 'Java环境正常'
                    : 'Java环境未找到，请安装Java并添加到PATH环境变量'}
                </p>
              </div>
              <button
                onClick={validateJava}
                className="ml-auto px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                重新检查
              </button>
            </div>
          </div>

          {minecraftLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">加载Minecraft服务器列表中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 服务器选择 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  选择服务端类型
                </h3>
                
                <div className="space-y-4">
                  {/* 服务器分类 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      服务器分类
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        setSelectedServer('')
                        setSelectedVersion('')
                        setAvailableVersions([])
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">请选择服务器分类</option>
                      {minecraftCategories.map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 具体服务端 */}
                  {selectedCategory && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        服务端
                      </label>
                      <select
                        value={selectedServer}
                        onChange={(e) => handleServerSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">请选择服务端</option>
                        {minecraftCategories
                          .find(cat => cat.name === selectedCategory)
                          ?.servers.map((server) => (
                            <option key={server} value={server}>
                              {server}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* 版本选择 */}
                  {selectedServer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Minecraft版本
                      </label>
                      <select
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">请选择版本</option>
                        {availableVersions.map((version) => (
                          <option key={version} value={version}>
                            {version}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 下载配置 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  下载配置
                </h3>
                
                <div className="space-y-4">
                  {/* 安装路径 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      安装路径
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={minecraftInstallPath}
                        onChange={(e) => setMinecraftInstallPath(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="输入服务端安装路径"
                      />
                      <button
                        onClick={() => {
                          const path = prompt('请输入安装路径:', 'D:\\MinecraftServers\\' + (selectedServer || 'server'))
                          if (path) setMinecraftInstallPath(path)
                        }}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 高级选项 */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      高级选项
                    </h4>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="skipJavaCheck"
                          checked={skipJavaCheck}
                          onChange={(e) => setSkipJavaCheck(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="skipJavaCheck" className="text-sm text-gray-700 dark:text-gray-300">
                          跳过Java环境检查
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="skipServerRun"
                          checked={skipServerRun}
                          onChange={(e) => setSkipServerRun(e.target.checked)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <label htmlFor="skipServerRun" className="text-sm text-gray-700 dark:text-gray-300">
                          跳过服务端运行（不生成EULA文件）
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 下载按钮 */}
                  <button
                    onClick={downloadMinecraftServer}
                    disabled={
                      !selectedServer || 
                      !selectedVersion || 
                      !minecraftInstallPath.trim() || 
                      minecraftDownloading
                    }
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {minecraftDownloading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        <span>下载中...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>下载服务端</span>
                      </>
                    )}
                  </button>

                  {/* 下载进度 */}
                  {downloadProgress && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>下载进度</span>
                        <span>{downloadProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${downloadProgress.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {Math.round(downloadProgress.loaded / 1024 / 1024)}MB / {Math.round(downloadProgress.total / 1024 / 1024)}MB
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 安装配置对话框 */}
      {showInstallModal && selectedGame && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                安装 {selectedGame.info.game_nameCN}
              </h3>
              <button
                onClick={() => setShowInstallModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 实例名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实例名称
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="输入实例名称"
                />
              </div>
              
              {/* 安装路径 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  安装路径
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={installPath}
                    onChange={(e) => setInstallPath(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="输入安装路径"
                  />
                  <button
                    onClick={selectInstallPath}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Steam账户设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Steam账户
                </label>
                <div className="space-y-3">
                  {/* 匿名账户选择 */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useAnonymous"
                      checked={useAnonymous}
                      onChange={(e) => setUseAnonymous(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="useAnonymous" className="text-sm text-gray-700 dark:text-gray-300">
                      使用匿名账户
                    </label>
                  </div>
                  
                  {/* Steam登录信息 */}
                  {!useAnonymous && (
                    <div className="space-y-3 pl-6 border-l-2 border-gray-200 dark:border-gray-600">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Steam用户名
                        </label>
                        <input
                          type="text"
                          value={steamUsername}
                          onChange={(e) => setSteamUsername(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="输入Steam用户名"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Steam密码
                        </label>
                        <input
                          type="password"
                          value={steamPassword}
                          onChange={(e) => setSteamPassword(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="输入Steam密码"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 游戏信息 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>AppID:</strong> {selectedGame.info.appid}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>提示:</strong> {selectedGame.info.tip}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={startInstallation}
                disabled={
                  !installPath.trim() || 
                  !instanceName.trim() || 
                  (!useAnonymous && (!steamUsername.trim() || !steamPassword.trim()))
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>开始安装</span>
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}

export default GameDeploymentPage