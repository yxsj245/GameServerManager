import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import TerminalPage from '@/pages/TerminalPage'
import SettingsPage from '@/pages/SettingsPage'
import LoadingSpinner from '@/components/LoadingSpinner'
import NotificationContainer from '@/components/NotificationContainer'

// 受保护的路由组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore()
  
  if (loading) {
    return <LoadingSpinner />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
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
  const { initTheme } = useThemeStore()
  
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
                  <Route path="/" element={<HomePage />} />
                  <Route path="/terminal" element={<TerminalPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      
      {/* 全局通知容器 */}
      <NotificationContainer />
    </div>
  )
}

export default App