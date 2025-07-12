import React, { useState, useEffect, useRef } from 'react'
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
  AlertCircle,
  Plus,
  Package
} from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import apiClient from '@/utils/api'
import { MinecraftServerCategory, MinecraftDownloadOptions, MinecraftDownloadProgress, MoreGameInfo, Platform } from '@/types'
import { io, Socket } from 'socket.io-client'
import config from '@/config'

interface GameInfo {
  game_nameCN: string
  appid: string
  tip: string
  image: string
  url: string
  system?: string[]
  supportedOnCurrentPlatform?: boolean
  currentPlatform?: string
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
  const [installModalAnimating, setInstallModalAnimating] = useState(false)
  const [selectedGame, setSelectedGame] = useState<{ key: string; info: GameInfo } | null>(null)
  const [installPath, setInstallPath] = useState('')
  const [installing, setInstalling] = useState(false)
  const [useAnonymous, setUseAnonymous] = useState(true)
  const [steamUsername, setSteamUsername] = useState('')
  const [steamPassword, setSteamPassword] = useState('')
  
  // 平台筛选状态
  const [platformFilter, setPlatformFilter] = useState<string>('all') // 'all', 'compatible', 'Windows', 'Linux', 'macOS'
  const [searchQuery, setSearchQuery] = useState('')

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
  const [downloadLogs, setDownloadLogs] = useState<string[]>([])
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [downloadResult, setDownloadResult] = useState<any>(null)
  const [showCreateInstanceModal, setShowCreateInstanceModal] = useState(false)
  const [createInstanceModalAnimating, setCreateInstanceModalAnimating] = useState(false)
  const [instanceName, setInstanceName] = useState('')
  const [instanceDescription, setInstanceDescription] = useState('')
  const [creatingInstance, setCreatingInstance] = useState(false)
  
  // 更多游戏部署相关状态
  const [moreGames, setMoreGames] = useState<MoreGameInfo[]>([])
  const [moreGamesLoading, setMoreGamesLoading] = useState(false)
  const [selectedMoreGame, setSelectedMoreGame] = useState<string>('')
  const [moreGameInstallPath, setMoreGameInstallPath] = useState('')
  const [moreGameDeploying, setMoreGameDeploying] = useState(false)
  const [moreGameDeployResult, setMoreGameDeployResult] = useState<any>(null)
  const [moreGameDeployProgress, setMoreGameDeployProgress] = useState<any>(null)
  const [moreGameDeployLogs, setMoreGameDeployLogs] = useState<string[]>([])
  const [moreGameDeployComplete, setMoreGameDeployComplete] = useState(false)
  
  // Minecraft整合包部署相关状态
  const [mrpackSearchQuery, setMrpackSearchQuery] = useState('')
  const [mrpackSearchResults, setMrpackSearchResults] = useState<any[]>([])
  const [mrpackSearchLoading, setMrpackSearchLoading] = useState(false)
  const [selectedMrpack, setSelectedMrpack] = useState<any>(null)
  const [mrpackVersions, setMrpackVersions] = useState<any[]>([])
  const [mrpackVersionsLoading, setMrpackVersionsLoading] = useState(false)
  const [selectedMrpackVersion, setSelectedMrpackVersion] = useState<any>(null)
  const [mrpackInstallPath, setMrpackInstallPath] = useState('')
  const [mrpackDeploying, setMrpackDeploying] = useState(false)
  const [mrpackDeployResult, setMrpackDeployResult] = useState<any>(null)
  const [mrpackDeployProgress, setMrpackDeployProgress] = useState<any>(null)
  const [mrpackDeployLogs, setMrpackDeployLogs] = useState<string[]>([])
  const [mrpackDeployComplete, setMrpackDeployComplete] = useState(false)
  
  // 整合包悬停详情状态
  const [hoveredMrpack, setHoveredMrpack] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 创建整合包实例相关状态
  const [showCreateMrpackInstanceModal, setShowCreateMrpackInstanceModal] = useState(false)
  const [createMrpackInstanceModalAnimating, setCreateMrpackInstanceModalAnimating] = useState(false)
  const [mrpackInstanceName, setMrpackInstanceName] = useState('')
  const [mrpackInstanceDescription, setMrpackInstanceDescription] = useState('')
  const [creatingMrpackInstance, setCreatingMrpackInstance] = useState(false)
  
  const socketRef = useRef<Socket | null>(null)
  const currentDownloadId = useRef<string | null>(null)
  const currentMoreGameDeploymentId = useRef<string | null>(null)
  const currentMrpackDeploymentId = useRef<string | null>(null)

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

  // 获取更多游戏列表
  const fetchMoreGames = async () => {
    try {
      setMoreGamesLoading(true)
      const response = await apiClient.getMoreGames()
      
      if (response.success) {
        setMoreGames(response.data || [])
      } else {
        throw new Error(response.message || '获取更多游戏列表失败')
      }
    } catch (error: any) {
      console.error('获取更多游戏列表失败:', error)
      addNotification({
        type: 'error',
        title: '获取失败',
        message: error.message || '无法获取更多游戏列表'
      })
    } finally {
      setMoreGamesLoading(false)
    }
  }

  // 部署更多游戏
  const deployMoreGame = async () => {
    if (!selectedMoreGame || !moreGameInstallPath) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请选择游戏和安装路径'
      })
      return
    }
    
    // 检查游戏是否支持当前平台
    const selectedGame = moreGames.find(g => g.id === selectedMoreGame)
    if (!selectedGame?.supportedOnCurrentPlatform) {
      addNotification({
        type: 'error',
        title: '平台不兼容',
        message: `${selectedGame?.name || '所选游戏'} 不支持当前平台`
      })
      return
    }

    try {
      // 重置状态
      setMoreGameDeploying(true)
      setMoreGameDeployResult(null)
      setMoreGameDeployProgress(null)
      setMoreGameDeployLogs([])
      setMoreGameDeployComplete(false)
      
      // 初始化WebSocket连接并等待连接建立
      initializeSocket()
      
      // 等待WebSocket连接建立
      const waitForConnection = () => {
        return new Promise<string>((resolve, reject) => {
          if (socketRef.current?.connected && socketRef.current?.id) {
            resolve(socketRef.current.id)
            return
          }
          
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket连接超时'))
          }, 10000) // 10秒超时
          
          const checkConnection = () => {
            if (socketRef.current?.connected && socketRef.current?.id) {
              clearTimeout(timeout)
              resolve(socketRef.current.id)
            } else {
              setTimeout(checkConnection, 100)
            }
          }
          
          checkConnection()
        })
      }
      
      const socketId = await waitForConnection()
      console.log('WebSocket连接已建立，Socket ID:', socketId)
      
      let response
      if (selectedMoreGame === 'tmodloader') {
        response = await apiClient.deployTModLoader({
          installPath: moreGameInstallPath,
          socketId
        })
      } else if (selectedMoreGame === 'factorio') {
        response = await apiClient.deployFactorio({
          installPath: moreGameInstallPath,
          socketId
        })
      } else {
        throw new Error('不支持的游戏类型')
      }
      
      if (response.success) {
        currentMoreGameDeploymentId.current = response.data?.deploymentId
        console.log('更多游戏部署开始，Deployment ID:', currentMoreGameDeploymentId.current)
        
        addNotification({
          type: 'info',
          title: '开始部署',
          message: `开始部署 ${selectedMoreGame}`
        })
      } else {
        throw new Error(response.message || '启动部署失败')
      }
    } catch (error: any) {
      console.error('启动部署失败:', error)
      setMoreGameDeploying(false)
      currentMoreGameDeploymentId.current = null
      addNotification({
        type: 'error',
        title: '部署失败',
        message: error.message || '无法启动游戏部署'
      })
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

  // 搜索Minecraft整合包
  const searchMrpackModpacks = async () => {
    if (!mrpackSearchQuery.trim()) {
      addNotification({
        type: 'error',
        title: '搜索错误',
        message: '请输入搜索关键词'
      })
      return
    }

    try {
      setMrpackSearchLoading(true)
      const response = await apiClient.searchMrpackModpacks({
        query: mrpackSearchQuery,
        limit: 20
      })
      
      if (response.success) {
        setMrpackSearchResults(response.data?.hits || [])
      } else {
        throw new Error(response.message || '搜索整合包失败')
      }
    } catch (error: any) {
      console.error('搜索整合包失败:', error)
      addNotification({
        type: 'error',
        title: '搜索失败',
        message: error.message || '无法搜索整合包'
      })
    } finally {
      setMrpackSearchLoading(false)
    }
  }

  // 获取整合包版本列表
  const fetchMrpackVersions = async (projectId: string) => {
    try {
      setMrpackVersionsLoading(true)
      const response = await apiClient.getMrpackProjectVersions(projectId)
      
      if (response.success) {
        setMrpackVersions(response.data || [])
        setSelectedMrpackVersion(null)
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
    } finally {
      setMrpackVersionsLoading(false)
    }
  }

  // 部署Minecraft整合包
  const deployMrpack = async () => {
    if (!selectedMrpack || !selectedMrpackVersion || !mrpackInstallPath.trim()) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请选择整合包、版本和安装路径'
      })
      return
    }

    try {
      // 重置状态
      setMrpackDeploying(true)
      setMrpackDeployResult(null)
      setMrpackDeployProgress(null)
      setMrpackDeployLogs([])
      setMrpackDeployComplete(false)
      
      // 初始化WebSocket连接并等待连接建立
      initializeSocket()
      
      // 等待WebSocket连接建立
      const waitForConnection = () => {
        return new Promise<string>((resolve, reject) => {
          if (socketRef.current?.connected && socketRef.current?.id) {
            resolve(socketRef.current.id)
            return
          }
          
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket连接超时'))
          }, 10000) // 10秒超时
          
          const checkConnection = () => {
            if (socketRef.current?.connected && socketRef.current?.id) {
              clearTimeout(timeout)
              resolve(socketRef.current.id)
            } else {
              setTimeout(checkConnection, 100)
            }
          }
          
          checkConnection()
        })
      }
      
      const socketId = await waitForConnection()
      console.log('WebSocket连接已建立，Socket ID:', socketId)
      
      const response = await apiClient.deployMrpack({
        projectId: selectedMrpack.project_id,
        versionId: selectedMrpackVersion.id,
        installPath: mrpackInstallPath,
        socketId
      })
      
      if (response.success) {
        currentMrpackDeploymentId.current = response.data?.deploymentId
        console.log('整合包部署开始，Deployment ID:', currentMrpackDeploymentId.current)
        
        addNotification({
          type: 'info',
          title: '开始部署',
          message: `开始部署整合包 ${selectedMrpack.title}`
        })
      } else {
        throw new Error(response.message || '启动部署失败')
      }
    } catch (error: any) {
      console.error('启动部署失败:', error)
      setMrpackDeploying(false)
      currentMrpackDeploymentId.current = null
      addNotification({
        type: 'error',
        title: '部署失败',
        message: error.message || '无法启动整合包部署'
      })
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

  // 初始化WebSocket连接
  const initializeSocket = () => {
    if (socketRef.current) {
      return
    }

    const token = localStorage.getItem('gsm3_token')
    socketRef.current = io(config.serverUrl, {
      auth: {
        token
      }
    })

    // 添加连接事件监听
    socketRef.current.on('connect', () => {
      console.log('WebSocket连接成功，Socket ID:', socketRef.current?.id)
    })

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket连接断开')
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('WebSocket连接错误:', error)
    })

    // 监听Minecraft下载进度
    socketRef.current.on('minecraft-download-progress', (data) => {
      if (data.downloadId === currentDownloadId.current) {
        const progress = data.progress
        setDownloadProgress({
          percentage: typeof progress === 'object' ? progress.percentage : progress,
          loaded: progress.loaded || 0,
          total: progress.total || 100
        })
      }
    })

    // 监听Minecraft下载日志
    socketRef.current.on('minecraft-download-log', (data) => {
      if (data.downloadId === currentDownloadId.current) {
        // 确保只添加字符串到日志中
        const message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
        setDownloadLogs(prev => [...prev, message])
      }
    })

    // 监听Minecraft下载完成
    socketRef.current.on('minecraft-download-complete', (data) => {
      console.log('收到下载完成事件:', data)
      if (data.downloadId === currentDownloadId.current) {
        setMinecraftDownloading(false)
        setDownloadComplete(true)
        setDownloadResult(data.data)
        
        addNotification({
          type: 'success',
          title: '下载完成',
          message: data.message || `${selectedServer} ${selectedVersion} 下载完成！`
        })
      }
    })

    // 监听Minecraft下载错误
    socketRef.current.on('minecraft-download-error', (data) => {
      console.log('收到下载错误事件:', data)
      if (data.downloadId === currentDownloadId.current) {
        setMinecraftDownloading(false)
        
        addNotification({
          type: 'error',
          title: '下载失败',
          message: data.error || '下载过程中发生错误'
        })
      }
    })

    // 监听游戏部署进度（包括更多游戏和Minecraft整合包）
    socketRef.current.on('more-games-deploy-progress', (data) => {
      console.log('收到整合包部署进度:', data)
      // 检查是否是整合包部署的进度
      if (data.deploymentId && data.deploymentId.startsWith('mrpack-deploy-')) {
        setMrpackDeployProgress(data.progress)
      } else {
        setMoreGameDeployProgress(data.progress)
      }
    })

    // 监听Minecraft整合包部署日志
    socketRef.current.on('more-games-deploy-log', (data) => {
      console.log('收到部署日志:', data)
      const message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message)
      // 检查是否是整合包部署的日志
      if (data.deploymentId && data.deploymentId.startsWith('mrpack-deploy-')) {
        setMrpackDeployLogs(prev => [...prev, message])
      } else {
        setMoreGameDeployLogs(prev => [...prev, message])
      }
    })

    // 监听Minecraft整合包部署完成
    socketRef.current.on('more-games-deploy-complete', (data) => {
      console.log('收到部署完成事件:', data)
      // 检查是否是整合包部署的完成事件
      if (data.deploymentId && data.deploymentId.startsWith('mrpack-deploy-')) {
        setMrpackDeploying(false)
        setMrpackDeployComplete(true)
        setMrpackDeployResult(data.data)
        currentMrpackDeploymentId.current = null // 重置整合包部署ID
        
        addNotification({
          type: 'success',
          title: '部署完成',
          message: data.message || '整合包部署完成！'
        })
      } else {
        setMoreGameDeploying(false)
        setMoreGameDeployComplete(true)
        setMoreGameDeployResult(data.data)
        currentMoreGameDeploymentId.current = null
        
        addNotification({
          type: 'success',
          title: '部署完成',
          message: data.message || '游戏部署完成！'
        })
      }
    })

    // 监听Minecraft整合包部署错误
    socketRef.current.on('more-games-deploy-error', (data) => {
      console.log('收到部署错误事件:', data)
      // 检查是否是整合包部署的错误事件
      if (data.deploymentId && data.deploymentId.startsWith('mrpack-deploy-')) {
        setMrpackDeploying(false)
        currentMrpackDeploymentId.current = null // 重置整合包部署ID
        
        addNotification({
          type: 'error',
          title: '部署失败',
          message: data.error || '整合包部署过程中发生错误'
        })
      } else {
        setMoreGameDeploying(false)
        currentMoreGameDeploymentId.current = null
        
        addNotification({
          type: 'error',
          title: '部署失败',
          message: data.error || '部署过程中发生错误'
        })
      }
    })
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
      // 重置状态
      setMinecraftDownloading(true)
      setDownloadProgress(null)
      setDownloadLogs([])
      setDownloadComplete(false)
      setDownloadResult(null)
      
      // 初始化WebSocket连接并等待连接建立
      initializeSocket()
      
      // 等待WebSocket连接建立
      const waitForConnection = () => {
        return new Promise<string>((resolve, reject) => {
          if (socketRef.current?.connected && socketRef.current?.id) {
            resolve(socketRef.current.id)
            return
          }
          
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket连接超时'))
          }, 10000) // 10秒超时
          
          const checkConnection = () => {
            if (socketRef.current?.connected && socketRef.current?.id) {
              clearTimeout(timeout)
              resolve(socketRef.current.id)
            } else {
              setTimeout(checkConnection, 100)
            }
          }
          
          checkConnection()
        })
      }
      
      const socketId = await waitForConnection()
      console.log('WebSocket连接已建立，Socket ID:', socketId)
      
      const downloadOptions: MinecraftDownloadOptions & { socketId?: string } = {
        server: selectedServer,
        version: selectedVersion,
        targetDirectory: minecraftInstallPath.trim(),
        skipJavaCheck,
        skipServerRun,
        socketId
      }
      
      const response = await apiClient.downloadMinecraftServer(downloadOptions)
      
      if (response.success) {
        currentDownloadId.current = response.data?.downloadId
        console.log('下载开始，Download ID:', currentDownloadId.current, 'Socket ID:', socketId)
        
        addNotification({
          type: 'info',
          title: '开始下载',
          message: `开始下载 ${selectedServer} ${selectedVersion}`
        })
      } else {
        throw new Error(response.message || '启动下载失败')
      }
    } catch (error: any) {
      console.error('启动Minecraft服务端下载失败:', error)
      setMinecraftDownloading(false)
      addNotification({
        type: 'error',
        title: '下载失败',
        message: error.message || '无法启动Minecraft服务端下载'
      })
    }
  }

  // 取消更多游戏部署
  const cancelMoreGameDeployment = async () => {
    if (!currentMoreGameDeploymentId.current) {
      addNotification({
        type: 'error',
        title: '取消失败',
        message: '没有正在进行的部署任务'
      })
      return
    }

    try {
      console.log('尝试取消部署，ID:', currentMoreGameDeploymentId.current)
      const response = await apiClient.cancelMoreGameDeployment(currentMoreGameDeploymentId.current)
      
      if (response.success) {
        // 重置部署状态
        setMoreGameDeploying(false)
        setMoreGameDeployProgress(null)
        currentMoreGameDeploymentId.current = null
        
        addNotification({
          type: 'info',
          title: '部署已取消',
          message: '更多游戏部署已取消'
        })
      } else {
        console.error('取消部署失败，服务器响应:', response)
        throw new Error(response.message || '取消部署失败')
      }
    } catch (error: any) {
      console.error('取消部署失败:', error)
      addNotification({
        type: 'error',
        title: '取消失败',
        message: error.message || '无法取消部署'
      })
    }
  }

  // 取消Minecraft下载
  const cancelMinecraftDownload = async () => {
    if (!currentDownloadId.current) {
      addNotification({
        type: 'error',
        title: '取消失败',
        message: '没有正在进行的下载任务'
      })
      return
    }

    try {
      const response = await apiClient.cancelMinecraftDownload(currentDownloadId.current)
      
      if (response.success) {
        // 重置下载状态
        setMinecraftDownloading(false)
        setDownloadProgress(null)
        currentDownloadId.current = null
        
        addNotification({
          type: 'info',
          title: '下载已取消',
          message: 'Minecraft服务端下载已取消'
        })
      } else {
        throw new Error(response.message || '取消下载失败')
      }
    } catch (error: any) {
      console.error('取消下载失败:', error)
      addNotification({
        type: 'error',
        title: '取消失败',
        message: error.message || '无法取消下载'
      })
    }
  }

  // 取消整合包部署
  const cancelMrpackDeployment = async () => {
    if (!currentMrpackDeploymentId.current) {
      addNotification({
        type: 'error',
        title: '取消失败',
        message: '没有正在进行的整合包部署任务'
      })
      return
    }

    try {
      console.log('尝试取消整合包部署，ID:', currentMrpackDeploymentId.current)
      const response = await apiClient.cancelMoreGameDeployment(currentMrpackDeploymentId.current)
      
      if (response.success) {
        // 重置部署状态
        setMrpackDeploying(false)
        setMrpackDeployProgress(null)
        currentMrpackDeploymentId.current = null
        
        addNotification({
          type: 'info',
          title: '部署已取消',
          message: '整合包部署已取消'
        })
      } else {
        console.error('取消整合包部署失败，服务器响应:', response)
        throw new Error(response.message || '取消整合包部署失败')
      }
    } catch (error: any) {
      console.error('取消整合包部署失败:', error)
      addNotification({
        type: 'error',
        title: '取消失败',
        message: error.message || '无法取消整合包部署'
      })
    }
  }

  // 处理整合包鼠标悬停
  const handleMrpackMouseEnter = (mrpackId: string) => {
    // 清除之前的定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    
    // 设置1秒后显示详情
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMrpack(mrpackId)
    }, 1000)
  }

  const handleMrpackMouseLeave = () => {
    // 清除定时器
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    
    // 隐藏详情
    setHoveredMrpack(null)
  }

  // 创建Minecraft实例
  const createMinecraftInstance = async () => {
    if (!instanceName.trim() || !downloadResult) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请填写实例名称'
      })
      return
    }

    try {
      setCreatingInstance(true)
      
      const response = await apiClient.createMinecraftInstance({
        name: instanceName.trim(),
        description: instanceDescription.trim() || `Minecraft ${selectedServer} ${selectedVersion}`,
        workingDirectory: downloadResult.targetDirectory,
        version: selectedVersion,
        serverType: selectedServer
      })
      
      if (response.success) {
        addNotification({
          type: 'success',
          title: '实例创建成功',
          message: `Minecraft实例 "${instanceName}" 创建成功！`
        })
        
        handleCloseCreateInstanceModal()
        
        // 重置表单
        setSelectedCategory('')
        setSelectedServer('')
        setSelectedVersion('')
        setMinecraftInstallPath('')
        setAvailableVersions([])
        setDownloadComplete(false)
        setDownloadResult(null)
        setInstanceName('')
        setInstanceDescription('')
        
        // 跳转到实例管理页面
        navigate('/instances')
      } else {
        throw new Error(response.error || '创建实例失败')
      }
    } catch (error: any) {
      console.error('创建Minecraft实例失败:', error)
      addNotification({
        type: 'error',
        title: '创建失败',
        message: error.message || '无法创建Minecraft实例'
      })
    } finally {
      setCreatingInstance(false)
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
    if (activeTab === 'more-games') {
      fetchMoreGames()
    }
  }, [activeTab])

  // 清理WebSocket连接和定时器
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      // 清理悬停定时器
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
    }
  }, [])

  // 打开安装对话框
  const handleInstallGame = (gameKey: string, gameInfo: GameInfo) => {
    // 检查游戏是否支持当前平台
    if (gameInfo.supportedOnCurrentPlatform === false) {
      addNotification({
        type: 'error',
        title: '平台不兼容',
        message: `${gameInfo.game_nameCN} 不支持当前平台 (${gameInfo.currentPlatform})，无法安装`
      })
      return
    }
    
    setSelectedGame({ key: gameKey, info: gameInfo })
    setInstanceName(gameInfo.game_nameCN)
    setInstallPath('')
    setShowInstallModal(true)
    setTimeout(() => setInstallModalAnimating(true), 10)
  }

  // 关闭安装对话框
  const handleCloseInstallModal = () => {
    setInstallModalAnimating(false)
    setTimeout(() => {
      setShowInstallModal(false)
    }, 300)
  }

  // 关闭创建实例对话框
  const handleCloseCreateInstanceModal = () => {
    setCreateInstanceModalAnimating(false)
    setTimeout(() => {
      setShowCreateInstanceModal(false)
    }, 300)
  }

  // 关闭创建整合包实例对话框
  const handleCloseCreateMrpackInstanceModal = () => {
    setCreateMrpackInstanceModalAnimating(false)
    setTimeout(() => {
      setShowCreateMrpackInstanceModal(false)
      // 重置表单
      setMrpackInstanceName('')
      setMrpackInstanceDescription('')
    }, 300)
  }

  // 创建整合包实例
  const createMrpackInstance = async () => {
    if (!mrpackInstanceName.trim() || !mrpackDeployResult) {
      addNotification({
        type: 'error',
        title: '参数错误',
        message: '请填写实例名称'
      })
      return
    }

    try {
      setCreatingMrpackInstance(true)
      
      const response = await apiClient.createInstance({
        name: mrpackInstanceName.trim(),
        description: mrpackInstanceDescription.trim() || `Minecraft整合包实例 - ${selectedMrpack?.title}`,
        workingDirectory: mrpackDeployResult.installPath,
        startCommand: mrpackDeployResult.serverJarPath ? `java -jar "${mrpackDeployResult.serverJarPath}"` : 'java -jar server.jar',
        autoStart: false,
        stopCommand: 'stop' as const
      })
      
      if (response.success) {
        addNotification({
          type: 'success',
          title: '实例创建成功',
          message: `实例 "${mrpackInstanceName.trim()}" 已创建，即将跳转到实例管理页面...`
        })
        
        handleCloseCreateMrpackInstanceModal()
        
        // 跳转到实例管理页面
        setTimeout(() => {
          navigate('/instances')
        }, 1500)
      } else {
        throw new Error(response.message || '创建实例失败')
      }
    } catch (error: any) {
      console.error('创建整合包实例失败:', error)
      addNotification({
        type: 'error',
        title: '创建失败',
        message: error.message || '无法创建整合包实例'
      })
    } finally {
      setCreatingMrpackInstance(false)
    }
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
      handleCloseInstallModal()
      
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
      
      if (response.success && response.data?.terminalSessionId) {
        addNotification({
          type: 'success',
          title: '安装已启动',
          message: `${selectedGame.info.game_nameCN} 安装已开始，即将跳转到终端页面...`
        })
        // 跳转到终端页面，并将会话ID作为参数传递
        setTimeout(() => {
          navigate(`/terminal?sessionId=${response.data.terminalSessionId}`)
        }, 1500) // 延迟以便用户看到通知
      } else {
        throw new Error(response.message || '安装失败，未返回终端会话ID')
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

  // 筛选游戏
  const filteredGames = Object.entries(games).filter(([gameKey, gameInfo]) => {
    // 搜索筛选
    if (searchQuery && !gameInfo.game_nameCN.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    
    // 平台筛选
    switch (platformFilter) {
      case 'all':
        return true
      case 'compatible':
        return gameInfo.supportedOnCurrentPlatform !== false
      case 'Windows':
      case 'Linux':
      case 'macOS':
        return gameInfo.system?.includes(platformFilter) || (!gameInfo.system || gameInfo.system.length === 0)
      default:
        return true
    }
  })

  const tabs = [
    { id: 'steamcmd', name: 'SteamCMD', icon: Download },
    { id: 'minecraft', name: 'Minecraft部署', icon: Pickaxe },
    { id: 'mrpack', name: 'Minecraft整合包部署', icon: Package },
    { id: 'more-games', name: '更多游戏部署', icon: Server }
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
          {/* 筛选器 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 搜索框 */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  搜索游戏
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="输入游戏名称搜索..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              {/* 平台筛选 */}
              <div className="sm:w-48">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  平台筛选
                </label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">全部游戏</option>
                  <option value="compatible">兼容当前平台</option>
                  <option value="Windows">Windows</option>
                  <option value="Linux">Linux</option>
                  <option value="macOS">macOS</option>
                </select>
               </div>
               
               {/* 清除筛选按钮 */}
               {(searchQuery || platformFilter !== 'all') && (
                 <div className="sm:w-auto flex items-end">
                   <button
                     onClick={() => {
                       setSearchQuery('')
                       setPlatformFilter('all')
                     }}
                     className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                   >
                     清除筛选
                   </button>
                 </div>
               )}
             </div>
             
             {/* 统计信息 */}
             <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
               显示 {filteredGames.length} / {Object.keys(games).length} 个游戏
               {platformFilter === 'compatible' && (
                 <span className="ml-2 text-green-600 dark:text-green-400">
                   (仅显示兼容游戏)
                 </span>
               )}
               {searchQuery && (
                 <span className="ml-2 text-blue-600 dark:text-blue-400">
                   (搜索: "{searchQuery}")
                 </span>
               )}
             </div>
          </div>
          
          {/* 游戏网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredGames.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                  <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">没有找到匹配的游戏</p>
                  <p className="text-sm">
                    {searchQuery ? '尝试修改搜索关键词' : '尝试更改筛选条件'}
                  </p>
                </div>
              </div>
            ) : (
              filteredGames.map(([gameKey, gameInfo]) => (
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
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-center">
                    {gameInfo.game_nameCN}
                  </h3>
                  
                  {/* 平台兼容性信息 */}
                  <div className="mb-4 text-center">
                    {gameInfo.system && gameInfo.system.length > 0 ? (
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <span>支持平台: {gameInfo.system.join(', ')}</span>
                        {gameInfo.currentPlatform && (
                          <div className={`mt-1 text-xs ${
                            gameInfo.supportedOnCurrentPlatform 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            当前平台: {gameInfo.currentPlatform} 
                            {gameInfo.supportedOnCurrentPlatform ? '✓ 兼容' : '✗ 不兼容'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ✓ 支持全平台
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <button
                    onClick={() => handleInstallGame(gameKey, gameInfo)}
                    disabled={gameInfo.supportedOnCurrentPlatform === false}
                    className={`w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                      gameInfo.supportedOnCurrentPlatform === false
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {gameInfo.supportedOnCurrentPlatform === false ? '平台不兼容' : '安装游戏'}
                    </span>
                  </button>
                </div>
              </div>
              ))
            )}
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
                  <div className="space-y-2">
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
                    
                    {/* 取消下载按钮 */}
                    {minecraftDownloading && (
                      <button
                        onClick={cancelMinecraftDownload}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>取消下载</span>
                      </button>
                    )}
                  </div>

                  {/* 下载进度 */}
                  {(downloadProgress || minecraftDownloading) && (
                    <div className="mt-4 space-y-3">
                      {downloadProgress && (
                        <div>
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
                          {downloadProgress.loaded && downloadProgress.total && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {Math.round(downloadProgress.loaded / 1024 / 1024)}MB / {Math.round(downloadProgress.total / 1024 / 1024)}MB
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 下载日志 */}
                      {downloadLogs.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            下载日志
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                            {downloadLogs.slice(-10).map((log, index) => (
                              <div key={index} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                {typeof log === 'string' ? log : JSON.stringify(log)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 下载完成后的操作 */}
                  {downloadComplete && downloadResult && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center space-x-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                          下载完成！
                        </h4>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                        {selectedServer} {selectedVersion} 已成功下载到 {downloadResult.targetDirectory}
                      </p>
                      <button
                        onClick={() => {
                          setInstanceName(`${selectedServer}-${selectedVersion}`)
                          setInstanceDescription(`Minecraft ${selectedServer} ${selectedVersion} 服务器`)
                          setShowCreateInstanceModal(true)
                          setTimeout(() => setCreateInstanceModalAnimating(true), 10)
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>创建实例</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 更多游戏部署标签页内容 */}
      {activeTab === 'more-games' && (
        <div className="space-y-6">
          {/* 游戏选择 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              选择游戏
            </h3>
            
            {moreGamesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">加载游戏列表中...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {moreGames.map((game) => {
                  const isSupported = game.supportedOnCurrentPlatform
                  const platformText = {
                    [Platform.WINDOWS]: 'Windows',
                    [Platform.LINUX]: 'Linux',
                    [Platform.MACOS]: 'macOS'
                  }
                  
                  return (
                    <div
                      key={game.id}
                      className={`
                        p-4 border-2 rounded-lg transition-all relative
                        ${!isSupported 
                          ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed opacity-60'
                          : selectedMoreGame === game.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer'
                        }
                      `}
                      onClick={() => isSupported && setSelectedMoreGame(game.id)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                           isSupported 
                             ? 'bg-gradient-to-br from-blue-500 to-purple-600' 
                             : 'bg-gray-400 dark:bg-gray-600'
                         }`}>
                           <Server className="w-6 h-6 text-white" />
                         </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium ${
                              isSupported 
                                ? 'text-gray-900 dark:text-white' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {game.name}
                            </h4>
                            {!isSupported && (
                              <AlertCircle className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <p className={`text-sm ${
                            isSupported 
                              ? 'text-gray-600 dark:text-gray-400' 
                              : 'text-gray-500 dark:text-gray-500'
                          }`}>
                            {game.description}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              isSupported 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              当前平台: {platformText[game.currentPlatform || Platform.LINUX]}
                            </span>
                            {!isSupported && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                                不支持当前平台
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            支持平台: {game.supportedPlatforms.map(p => platformText[p]).join(', ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 部署配置 */}
          {selectedMoreGame && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                部署配置
              </h3>
              
              <div className="space-y-4">
                {/* 安装路径 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    安装路径 *
                  </label>
                  <input
                    type="text"
                    value={moreGameInstallPath}
                    onChange={(e) => setMoreGameInstallPath(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={`输入 ${moreGames.find(g => g.id === selectedMoreGame)?.name} 的安装路径`}
                  />
                </div>
                
                {/* 平台兼容性提示 */}
                {(() => {
                  const selectedGame = moreGames.find(g => g.id === selectedMoreGame)
                  if (selectedGame && !selectedGame.supportedOnCurrentPlatform) {
                    return (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                        <div className="flex items-center space-x-2 text-orange-800 dark:text-orange-400">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-medium">平台不兼容</span>
                        </div>
                        <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                          {selectedGame.name} 不支持当前平台 ({selectedGame.currentPlatform})。
                          支持的平台: {selectedGame.supportedPlatforms.map(p => {
                            const platformText = {
                              [Platform.WINDOWS]: 'Windows',
                              [Platform.LINUX]: 'Linux',
                              [Platform.MACOS]: 'macOS'
                            }
                            return platformText[p]
                          }).join(', ')}
                        </p>
                      </div>
                    )
                  }
                  return null
                })()}
                
                {/* 部署按钮 */}
                <div className="space-y-2">
                  <div className="flex justify-end">
                    {(() => {
                      const selectedGame = moreGames.find(g => g.id === selectedMoreGame)
                      const isGameSupported = selectedGame?.supportedOnCurrentPlatform ?? false
                      const isDisabled = moreGameDeploying || !moreGameInstallPath.trim() || !isGameSupported
                      
                      return (
                        <button
                          onClick={deployMoreGame}
                          disabled={isDisabled}
                          className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                            isDisabled
                              ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {moreGameDeploying ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              <span>部署中...</span>
                            </>
                          ) : !isGameSupported ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              <span>不支持当前平台</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              <span>开始部署</span>
                            </>
                          )}
                        </button>
                      )
                    })()} 
                  </div>
                  
                  {/* 取消部署按钮 */}
                  {moreGameDeploying && (
                    <div className="flex justify-end">
                      <button
                        onClick={cancelMoreGameDeployment}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>取消部署</span>
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 部署进度 */}
                {(moreGameDeployProgress || moreGameDeploying) && (
                  <div className="mt-4 space-y-3">
                    {moreGameDeployProgress && (
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>部署进度</span>
                          <span>{moreGameDeployProgress.percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${moreGameDeployProgress.percentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* 部署日志 */}
                    {moreGameDeployLogs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          部署日志
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                          {moreGameDeployLogs.slice(-10).map((log, index) => (
                            <div key={index} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              {typeof log === 'string' ? log : JSON.stringify(log)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 部署完成后的操作 */}
          {moreGameDeployComplete && moreGameDeployResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                部署完成
              </h3>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-green-800 dark:text-green-400 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">部署成功！</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1 mb-3">
                  <p><strong>安装路径:</strong> {moreGameDeployResult.installPath}</p>
                  {moreGameDeployResult.version && (
                    <p><strong>版本:</strong> {moreGameDeployResult.version}</p>
                  )}
                  {moreGameDeployResult.serverExecutablePath && (
                    <p><strong>服务端文件:</strong> {moreGameDeployResult.serverExecutablePath}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    // 重置状态
                    setSelectedMoreGame('')
                    setMoreGameInstallPath('')
                    setMoreGameDeployComplete(false)
                    setMoreGameDeployResult(null)
                    setMoreGameDeployProgress(null)
                    setMoreGameDeployLogs([])
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>部署其他游戏</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Minecraft整合包部署标签页内容 */}
      {activeTab === 'mrpack' && (
        <div className="space-y-6">
          {/* 搜索整合包 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              搜索Minecraft整合包
            </h3>
            
            <div className="flex space-x-4 mb-4">
              <input
                type="text"
                value={mrpackSearchQuery}
                onChange={(e) => setMrpackSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchMrpackModpacks()}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="输入整合包名称或关键词"
              />
              <button
                onClick={searchMrpackModpacks}
                disabled={mrpackSearchLoading || !mrpackSearchQuery.trim()}
                className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                  mrpackSearchLoading || !mrpackSearchQuery.trim()
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {mrpackSearchLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>搜索中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>搜索</span>
                  </>
                )}
              </button>
            </div>
            
            {/* 搜索结果 */}
            {mrpackSearchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mrpackSearchResults.map((modpack) => (
                  <div
                    key={modpack.project_id}
                    className={`
                      p-4 border-2 rounded-lg transition-all cursor-pointer
                      ${selectedMrpack?.project_id === modpack.project_id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }
                    `}
                    onClick={() => setSelectedMrpack(modpack)}
                    onMouseEnter={() => handleMrpackMouseEnter(modpack.project_id)}
                    onMouseLeave={handleMrpackMouseLeave}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        {modpack.icon_url ? (
                          <img
                            src={modpack.icon_url}
                            alt={modpack.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // 图片加载失败时显示默认图标
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.className = 'w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center';
                                parent.innerHTML = '<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                            <Package className="w-6 h-6 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {modpack.title}
                        </h4>
                        <p className={`text-sm text-gray-600 dark:text-gray-400 transition-all duration-300 ${
                          hoveredMrpack === modpack.project_id ? '' : 'line-clamp-2'
                        }`}>
                          {modpack.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            下载: {modpack.downloads?.toLocaleString() || 0}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                            作者: {modpack.author}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              mrpackSearchQuery && !mrpackSearchLoading && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    未找到相关整合包
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    没有找到与 "{mrpackSearchQuery}" 相关的整合包，请尝试其他关键词
                  </p>
                  <button
                    onClick={() => {
                      setMrpackSearchQuery('')
                      setMrpackSearchResults([])
                    }}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    清除搜索
                  </button>
                </div>
              )
            )}
          </div>

          {/* 部署配置 */}
          {selectedMrpack && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                部署配置
              </h3>
              
              <div className="space-y-4">
                {/* 选中的整合包信息 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      {selectedMrpack.icon_url ? (
                        <img
                          src={selectedMrpack.icon_url}
                          alt={selectedMrpack.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 图片加载失败时显示默认图标
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.className = 'w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center';
                              parent.innerHTML = '<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-600 flex items-center justify-center">
                          <Package className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-400 mb-2">
                        <span className="font-medium">选中的整合包</span>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>{selectedMrpack.title}</strong> - {selectedMrpack.description}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 版本选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    选择版本 *
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => fetchMrpackVersions(selectedMrpack.project_id)}
                      disabled={mrpackVersionsLoading}
                      className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                        mrpackVersionsLoading
                          ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {mrpackVersionsLoading ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>加载中...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>获取版本列表</span>
                        </>
                      )}
                    </button>
                    
                    {mrpackVersions.length > 0 && (
                      <select
                        value={selectedMrpackVersion?.id || ''}
                        onChange={(e) => {
                          const version = mrpackVersions.find(v => v.id === e.target.value)
                          setSelectedMrpackVersion(version || null)
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">请选择版本</option>
                        {mrpackVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            {version.name} ({version.version_number}) - {version.game_versions?.join(', ')}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  {selectedMrpackVersion && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>版本:</strong> {selectedMrpackVersion.name} ({selectedMrpackVersion.version_number})
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>支持的Minecraft版本:</strong> {selectedMrpackVersion.game_versions?.join(', ')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>加载器:</strong> {selectedMrpackVersion.loaders?.join(', ')}
                      </p>
                      {selectedMrpackVersion.changelog && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          <strong>更新日志:</strong> {selectedMrpackVersion.changelog.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* 安装路径 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    安装路径 *
                  </label>
                  <input
                    type="text"
                    value={mrpackInstallPath}
                    onChange={(e) => setMrpackInstallPath(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="输入整合包的安装路径"
                  />
                </div>
                
                {/* 部署按钮 */}
                <div className="space-y-2">
                  <div className="flex justify-end space-x-3">
                    {mrpackDeploying && (
                      <button
                        onClick={cancelMrpackDeployment}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>取消部署</span>
                      </button>
                    )}
                    <button
                      onClick={deployMrpack}
                      disabled={mrpackDeploying || !mrpackInstallPath.trim()}
                      className={`px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                        mrpackDeploying || !mrpackInstallPath.trim()
                          ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {mrpackDeploying ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          <span>部署中...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>开始部署</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* 部署进度 */}
                {(mrpackDeployProgress || mrpackDeploying) && (
                  <div className="mt-4 space-y-3">
                    {mrpackDeployProgress && (
                      <div>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>部署进度</span>
                          <span>{mrpackDeployProgress.percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${mrpackDeployProgress.percentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {/* 部署日志 */}
                    {mrpackDeployLogs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          部署日志
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                          {mrpackDeployLogs.slice(-10).map((log, index) => (
                            <div key={index} className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              {typeof log === 'string' ? log : JSON.stringify(log)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 部署完成后的操作 */}
          {mrpackDeployComplete && mrpackDeployResult && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                部署完成
              </h3>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-green-800 dark:text-green-400 mb-3">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">部署成功！</span>
                </div>
                <div className="flex items-start space-x-3 mb-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedMrpack?.icon_url ? (
                      <img
                        src={selectedMrpack.icon_url}
                        alt={selectedMrpack.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 图片加载失败时显示默认图标
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.className = 'w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center';
                            parent.innerHTML = '<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-green-600 flex items-center justify-center">
                        <Package className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-sm text-green-700 dark:text-green-300 space-y-1">
                    <p><strong>整合包:</strong> {selectedMrpack?.title}</p>
                    <p><strong>安装路径:</strong> {mrpackDeployResult.installPath}</p>
                    {mrpackDeployResult.version && (
                      <p><strong>版本:</strong> {mrpackDeployResult.version}</p>
                    )}
                    {mrpackDeployResult.serverJarPath && (
                      <p><strong>服务端文件:</strong> {mrpackDeployResult.serverJarPath}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      // 打开创建整合包实例对话框
                      setShowCreateMrpackInstanceModal(true)
                      setCreateMrpackInstanceModalAnimating(true)
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Server className="w-4 h-4" />
                    <span>创建实例</span>
                  </button>
                  <button
                    onClick={() => {
                      // 重置状态
                      setSelectedMrpack(null)
                      setMrpackInstallPath('')
                      setMrpackDeployComplete(false)
                      setMrpackDeployResult(null)
                      setMrpackDeployProgress(null)
                      setMrpackDeployLogs([])
                      setMrpackSearchResults([])
                      setMrpackSearchQuery('')
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>部署其他整合包</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 安装配置对话框 */}
      {showInstallModal && selectedGame && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-300 ${
          installModalAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 ${
            installModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                安装 {selectedGame.info.game_nameCN}
              </h3>
              <button
                onClick={handleCloseInstallModal}
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
                onClick={handleCloseInstallModal}
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

      {/* 创建Minecraft实例对话框 */}
      {showCreateInstanceModal && downloadResult && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-300 ${
          createInstanceModalAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 ${
            createInstanceModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                创建Minecraft实例
              </h3>
              <button
                onClick={handleCloseCreateInstanceModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 服务器信息 */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  服务器信息
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  类型: {selectedServer} | 版本: {selectedVersion}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  路径: {downloadResult.targetDirectory}
                </p>
              </div>
              
              {/* 实例名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实例名称 *
                </label>
                <input
                  type="text"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="输入实例名称"
                />
              </div>
              
              {/* 实例描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实例描述
                </label>
                <textarea
                  value={instanceDescription}
                  onChange={(e) => setInstanceDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="输入实例描述（可选）"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseCreateInstanceModal}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={createMinecraftInstance}
                disabled={!instanceName.trim() || creatingInstance}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {creatingInstance ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>创建中...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>创建实例</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创建整合包实例对话框 */}
      {showCreateMrpackInstanceModal && mrpackDeployResult && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-300 ${
          createMrpackInstanceModalAnimating ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300 ${
            createMrpackInstanceModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                创建整合包实例
              </h3>
              <button
                onClick={handleCloseCreateMrpackInstanceModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 整合包信息 */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedMrpack?.icon_url ? (
                      <img
                        src={selectedMrpack.icon_url}
                        alt={selectedMrpack.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // 图片加载失败时显示默认图标
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.className = 'w-12 h-12 rounded-lg bg-green-600 flex items-center justify-center';
                            parent.innerHTML = '<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-green-600 flex items-center justify-center">
                        <Package className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      整合包信息
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      名称: {selectedMrpack?.title}
                    </p>
                    {mrpackDeployResult.version && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        版本: {mrpackDeployResult.version}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      路径: {mrpackDeployResult.installPath}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 实例名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实例名称 *
                </label>
                <input
                  type="text"
                  value={mrpackInstanceName}
                  onChange={(e) => setMrpackInstanceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="输入实例名称"
                />
              </div>
              
              {/* 实例描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  实例描述
                </label>
                <textarea
                  value={mrpackInstanceDescription}
                  onChange={(e) => setMrpackInstanceDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="输入实例描述（可选）"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseCreateMrpackInstanceModal}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                取消
              </button>
              <button
                onClick={createMrpackInstance}
                disabled={!mrpackInstanceName.trim() || creatingMrpackInstance}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {creatingMrpackInstance ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>创建中...</span>
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4" />
                    <span>创建实例</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameDeploymentPage