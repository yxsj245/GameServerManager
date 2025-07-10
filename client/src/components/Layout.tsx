import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
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
  Info
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-black dark:text-gray-300">已连接</span>
            </div>
          </div>
        </div>
        
        {/* 页面内容 */}
        <main className="p-6 relative overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout