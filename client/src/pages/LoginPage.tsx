import React, { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useThemeStore } from '@/stores/themeStore'
import { Eye, EyeOff, Gamepad2, Sun, Moon, Loader2 } from 'lucide-react'

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, loading, error } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const { theme, toggleTheme } = useThemeStore()
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim() || !password.trim()) {
      addNotification({
        type: 'warning',
        title: '输入错误',
        message: '请输入用户名和密码'
      })
      return
    }
    
    const result = await login({ username: username.trim(), password })
    
    if (result.success) {
      addNotification({
        type: 'success',
        title: '登录成功',
        message: '欢迎回来！'
      })
    } else {
      addNotification({
        type: 'error',
        title: '登录失败',
        message: result.message
      })
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-game-gradient p-4">
      {/* 主题切换按钮 */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-3 glass rounded-full text-black dark:text-white hover:bg-white/20 transition-all duration-200"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      
      <div className="w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 glass rounded-full">
              <Gamepad2 className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <h1 className="text-4xl font-bold font-game neon-text mb-2">
            GSManager3
          </h1>
          <p className="text-gray-700 dark:text-gray-300 font-display">
            游戏服务器管理面板
          </p>
        </div>
        
        {/* 登录表单 */}
        <div className="card-game p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 用户名输入 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="
                  w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg
                  text-black dark:text-white placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-all duration-200
                "
                placeholder="请输入用户名"
                disabled={loading}
              />
            </div>
            
            {/* 密码输入 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="
                    w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg
                    text-black dark:text-white placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200
                  "
                  placeholder="请输入密码"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {/* 错误信息 */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full btn-game py-3 font-semibold
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center space-x-2
              "
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>登录中...</span>
                </>
              ) : (
                <span>登录</span>
              )}
            </button>
          </form>
          
          {/* 底部信息 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              GSManager3 游戏服务器管理面板 v1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage