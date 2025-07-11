import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import Layout from '@/components/Layout'
import PageTransition from '@/components/PageTransition'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import TerminalPage from '@/pages/TerminalPage'
import InstanceManagerPage from '@/pages/InstanceManagerPage'
import GameDeploymentPage from './pages/GameDeploymentPage'
import ScheduledTasksPage from '@/pages/ScheduledTasksPage'
import SettingsPage from '@/pages/SettingsPage'
import FileManagerPage from '@/pages/FileManagerPage'
import AboutProjectPage from '@/pages/AboutProjectPage'
import LoadingSpinner from '@/components/LoadingSpinner'
import NotificationContainer from '@/components/NotificationContainer'
import GlobalMusicPlayer from '@/components/GlobalMusicPlayer'

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!isAuthenticated) {
    // 不再自动跳转到登录页，显示未认证提示
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            需要登录
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            请登录后访问此页面
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            前往登录
          </button>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
}

// 公共路由组件（已登录用户重定向到首页）
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function App() {
  const { verifyToken, setLoading } = useAuthStore()
  const { theme: currentTheme, initTheme } = useThemeStore()
  
  useEffect(() => {
    // 初始化主题
    initTheme()
    
    // 验证token
    const initAuth = async () => {
      setLoading(true)
      try {
        await verifyToken()
      } catch (error) {
        console.error('Token验证失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    initAuth()
  }, [])
  
  return (
    <ConfigProvider
      theme={{
        algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <div className="min-h-screen bg-game-gradient">
          <Routes>
            {/* 公共路由 */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            
            {/* 受保护的路由 */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
                      <Route path="/terminal" element={<PageTransition><TerminalPage /></PageTransition>} />
                      <Route path="/instances" element={<PageTransition><InstanceManagerPage /></PageTransition>} />
                      <Route path="/game-deployment" element={<PageTransition><GameDeploymentPage /></PageTransition>} />
                      <Route path="/scheduled-tasks" element={<PageTransition><ScheduledTasksPage /></PageTransition>} />
                      <Route path="/files" element={<PageTransition><FileManagerPage /></PageTransition>} />
                      <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
                      <Route path="/about" element={<PageTransition><AboutProjectPage /></PageTransition>} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          
          {/* 全局通知容器 */}
          <NotificationContainer />
          
          {/* 全局音乐播放器 */}
          <GlobalMusicPlayer />
        </div>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App