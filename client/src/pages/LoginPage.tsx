import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useThemeStore } from '@/stores/themeStore'
import { Eye, EyeOff, Gamepad2, Sun, Moon, Loader2, RefreshCw } from 'lucide-react'
import apiClient from '@/utils/api'
import { CaptchaData } from '@/types'
import LoginTransition from '@/components/LoginTransition'

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaData, setCaptchaData] = useState<CaptchaData | null>(null)
  const [requireCaptcha, setRequireCaptcha] = useState(false)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [isAnimating, setIsAnimating] = useState(true)
  const [showLoginTransition, setShowLoginTransition] = useState(false)
  const { login, loading, error } = useAuthStore()
  const { addNotification } = useNotificationStore()
  const { theme, toggleTheme } = useThemeStore()

  // 页面加载动画
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [])
  
  // 检查是否需要验证码
  const checkCaptchaRequired = async (usernameValue: string) => {
    if (!usernameValue.trim()) return
    
    try {
      const response = await apiClient.checkCaptchaRequired(usernameValue.trim())
      if (response.success) {
        setRequireCaptcha(response.requireCaptcha)
        if (response.requireCaptcha && !captchaData) {
          await loadCaptcha()
        }
      }
    } catch (error) {
      console.error('检查验证码需求失败:', error)
    }
  }

  // 加载验证码
  const loadCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const response = await apiClient.getCaptcha()
      if (response.success) {
        setCaptchaData(response.captcha)
        setCaptchaCode('')
      } else {
        addNotification({
          type: 'error',
          title: '获取验证码失败',
          message: '请稍后重试'
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '获取验证码失败',
        message: '请检查网络连接'
      })
    } finally {
      setCaptchaLoading(false)
    }
  }

  // 刷新验证码
  const refreshCaptcha = () => {
    loadCaptcha()
  }

  // 用户名输入变化时检查是否需要验证码
  useEffect(() => {
    const timer = setTimeout(() => {
      checkCaptchaRequired(username)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [username])

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

    if (requireCaptcha && (!captchaData || !captchaCode.trim())) {
      addNotification({
        type: 'warning',
        title: '输入错误',
        message: '请输入验证码'
      })
      return
    }
    
    setIsLoggingIn(true)
    
    const credentials = {
      username: username.trim(),
      password,
      ...(requireCaptcha && captchaData ? {
        captchaId: captchaData.id,
        captchaCode: captchaCode.trim()
      } : {})
    }
    
    const result = await login(credentials)
    
    if (result.success) {
      setLoginSuccess(true)
      setShowLoginTransition(true)
      addNotification({
        type: 'success',
        title: '登录成功',
        message: '欢迎回来！'
      })
      
      // 延迟一下让用户看到成功动画
      setTimeout(() => {
        setIsLoggingIn(false)
      }, 1000)
    } else {
      setIsLoggingIn(false)
      addNotification({
        type: 'error',
        title: '登录失败',
        message: result.message
      })
      
      // 如果登录失败且需要验证码，刷新验证码
      if (requireCaptcha) {
        refreshCaptcha()
      }
    }
  }
  
  return (
    <>
      {/* 登录过渡动画 */}
      <LoginTransition 
        isVisible={showLoginTransition} 
        onComplete={() => {
          setShowLoginTransition(false)
        }}
      />
      
      <div className={`
        min-h-screen flex items-center justify-center p-4 transition-all duration-1000
        ${theme === 'dark' 
          ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-background-shift' 
          : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
        }
      `}>
      {/* 主题切换按钮 */}
      <button
        onClick={toggleTheme}
        className={`
          fixed top-4 right-4 p-3 glass rounded-full text-black dark:text-white 
          hover:bg-white/20 transition-all duration-200 z-10
          ${isAnimating ? 'opacity-0 translate-y-[-20px]' : 'opacity-100 translate-y-0 animate-form-field-slide-in animate-delay-500'}
        `}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
      
      <div className={`
        w-full max-w-md transition-all duration-600
        ${isAnimating ? 'opacity-0 translate-y-10 scale-95' : 'opacity-100 translate-y-0 scale-100 animate-login-slide-in'}
        ${loginSuccess ? 'animate-page-transition-out' : ''}
      `}>
        {/* Logo和标题 */}
        <div className={`
          text-center mb-8
          ${isAnimating ? 'opacity-0' : 'opacity-100 animate-form-field-slide-in animate-delay-200'}
        `}>
          <div className="flex justify-center mb-4">
            <div className={`
              p-4 glass rounded-full transition-all duration-300
              ${!isAnimating ? 'animate-logo-float' : ''}
              ${loginSuccess ? 'animate-success-checkmark' : ''}
            `}>
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
        <div className={`
          card-game p-8 transition-all duration-800
          ${isAnimating ? 'opacity-0' : 'opacity-100 animate-fade-in'}
          ${loginSuccess ? 'scale-105 shadow-2xl' : ''}
        `}>
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
                  transition-all duration-200 hover:border-white/30
                  focus:scale-[1.02] focus:shadow-lg
                "
                placeholder="请输入用户名"
                disabled={loading || isLoggingIn}
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
                    transition-all duration-200 hover:border-white/30
                    focus:scale-[1.02] focus:shadow-lg
                  "
                  placeholder="请输入密码"
                  disabled={loading || isLoggingIn}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white transition-all duration-200 hover:scale-110"
                  disabled={loading || isLoggingIn}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* 验证码输入 */}
            {requireCaptcha && (
              <div>
                <label htmlFor="captcha" className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                  验证码
                </label>
                <div className="flex space-x-3">
                  <input
                    id="captcha"
                    type="text"
                    value={captchaCode}
                    onChange={(e) => setCaptchaCode(e.target.value)}
                    className="
                      flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg
                      text-black dark:text-white placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-200 hover:border-white/30
                      focus:scale-[1.02] focus:shadow-lg
                    "
                    placeholder="请输入验证码"
                    disabled={loading || captchaLoading || isLoggingIn}
                    maxLength={4}
                  />
                  <div className="flex items-center space-x-2">
                    {/* 验证码图片 */}
                    <div 
                      className="
                        w-24 h-12 bg-white/10 border border-white/20 rounded-lg
                        flex items-center justify-center cursor-pointer
                        hover:bg-white/20 transition-all duration-200
                      "
                      onClick={refreshCaptcha}
                    >
                      {captchaLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      ) : captchaData ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: captchaData.svg }}
                          className="w-full h-full flex items-center justify-center"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">验证码</span>
                      )}
                    </div>
                    {/* 刷新按钮 */}
                    <button
                      type="button"
                      onClick={refreshCaptcha}
                      disabled={loading || captchaLoading || isLoggingIn}
                      className="
                        p-3 bg-white/10 border border-white/20 rounded-lg
                        text-gray-400 hover:text-black dark:hover:text-white
                        hover:bg-white/20 transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        hover:scale-110 active:scale-95
                      "
                      title="刷新验证码"
                    >
                      <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  点击验证码图片或刷新按钮可以更换验证码
                </p>
              </div>
            )}
            
            {/* 错误信息 */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg transition-all duration-300">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            
            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading || isLoggingIn}
              className={`
                w-full py-3 font-semibold transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center space-x-2
                ${isLoggingIn 
                  ? 'bg-green-600 hover:bg-green-700 animate-button-pulse' 
                  : 'btn-game hover:scale-105 active:scale-95'
                }
                ${loginSuccess ? 'bg-green-500 scale-110' : ''}
              `}
            >
              {isLoggingIn ? (
                loginSuccess ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>登录成功！</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>登录中...</span>
                  </>
                )
              ) : (
                <span>登录</span>
              )}
            </button>
          </form>
          
          {/* 底部信息 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              GSManager3 游戏服务器管理面板
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default LoginPage