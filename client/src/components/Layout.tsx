import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import socketClient from '@/utils/socket'
import {
  Home,
  Terminal,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  User,
  Gamepad2,
  FolderOpen,
  Server,
  Download,
  Clock,
  Info,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(socketClient.isConnected())
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  
  const navigation = [
    { name: '首页', href: '/', icon: Home },
    { name: '终端', href: '/terminal', icon: Terminal },
    { name: '实例管理', href: '/instances', icon: Server },
    { name: '游戏部署', href: '/game-deployment', icon: Download },
    { name: '定时任务', href: '/scheduled-tasks', icon: Clock },
    { name: '文件管理', href: '/files', icon: FolderOpen },
    { name: '设置', href: '/settings', icon: Settings },
    { name: '关于项目', href: '/about', icon: Info },
  ]
  
  const handleLogout = async () => {
    await logout()
  }

  // WebSocket连接状态监听
  useEffect(() => {
    const handleConnectionStatus = (data: { connected: boolean; reason?: string }) => {
      setIsConnected(data.connected)
      if (!data.connected) {
        setShowDisconnectModal(true)
      } else {
        setShowDisconnectModal(false)
        setReconnecting(false)
      }
    }

    const handleConnectionError = () => {
      setIsConnected(false)
      setShowDisconnectModal(true)
    }

    const handleMaxReconnectAttempts = () => {
      setReconnecting(false)
    }

    // 监听连接状态变化
    socketClient.on('connection-status', handleConnectionStatus)
    socketClient.on('connection-error', handleConnectionError)
    socketClient.on('max-reconnect-attempts', handleMaxReconnectAttempts)

    // 初始化连接状态
    setIsConnected(socketClient.isConnected())

    return () => {
      socketClient.off('connection-status', handleConnectionStatus)
      socketClient.off('connection-error', handleConnectionError)
      socketClient.off('max-reconnect-attempts', handleMaxReconnectAttempts)
    }
  }, [])

  // 手动重连
  const handleReconnect = () => {
    setReconnecting(true)
    socketClient.reconnectManually()
  }

  // 关闭弹窗
  const handleCloseModal = () => {
    setShowDisconnectModal(false)
  }
  
  return (
    <div className="min-h-screen bg-game-gradient">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* 侧边栏 */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col glass border-r border-white/20 dark:border-gray-700/30">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-white/20 dark:border-gray-700/30">
            <div className="flex items-center space-x-3">
              <Gamepad2 className="w-8 h-8 text-blue-500" />
              <span className="text-xl font-bold font-game neon-text">
                GSManager3
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-black dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* 导航菜单 */}
          <nav className="flex-1 px-3 py-5 space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center space-x-2.5 px-3 py-2.5 rounded-lg transition-all duration-300 ease-in-out transform
                    hover:scale-105 hover:shadow-md active:scale-95
                    ${isActive
                      ? 'bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-lg scale-105'
                      : 'text-black dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              )
            })}
          </nav>
          
          {/* 用户信息和操作 */}
          <div className="border-t border-white/20 dark:border-gray-700/30 p-4 space-y-4">
            {/* 主题切换 */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-2.5 w-full px-3 py-2.5 text-black dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-black dark:hover:text-white rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-md active:scale-95"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span className="font-medium">
                {theme === 'dark' ? '浅色模式' : '深色模式'}
              </span>
            </button>
            
            {/* 用户信息 */}
            <div className="flex items-center space-x-2.5 px-3 py-2.5 bg-gray-100 dark:bg-white/5 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-md">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black dark:text-white truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {user?.role === 'admin' ? '管理员' : '用户'}
                </p>
              </div>
            </div>
            
            {/* 登出按钮 */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2.5 w-full px-3 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-md active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">登出</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* 主内容区域 */}
      <div className="lg:pl-64">
        {/* 顶部栏 */}
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 glass border-b border-gray-200 dark:border-gray-700/30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-black dark:text-white font-display">
              {navigation.find(item => item.href === location.pathname)?.name || 'GSM3 游戏面板'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* 连接状态指示器 */}
            <div 
              className="flex items-center space-x-2 cursor-help" 
              title="WebSocket是一种网络通信协议，允许服务器和客户端之间进行实时双向通信。在GSManager3中，WebSocket作为核心功能，用于实时传输终端输出、系统状态更新、游戏服务器状态变化等信息，确保您能够及时获得最新的系统反馈。"
            >
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-black dark:text-gray-300">WebSocket连接已建立</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-500 dark:text-red-400">WebSocket连接中断</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* 页面内容 */}
        <main className="p-6 relative overflow-hidden">
          {children}
        </main>
      </div>

      {/* WebSocket连接中断弹窗 */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 transform transition-all duration-300">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  连接中断
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    WebSocket连接已中断，这可能会影响实时功能的使用，如终端输出、系统监控等。
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      可能的原因：
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• 网络连接不稳定</li>
                      <li>• 服务器临时不可用</li>
                      <li>• 认证令牌已过期</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                稍后处理
              </button>
              <button
                onClick={handleReconnect}
                disabled={reconnecting}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {reconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>重连中...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>立即重连</span>
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

export default Layout