import React, { useState } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  Settings,
  Palette,
  Bell,
  Terminal,
  Shield,
  User,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Check
} from 'lucide-react'

const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore()
  const { user, changePassword } = useAuthStore()
  const { addNotification } = useNotificationStore()
  
  // 密码修改状态
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // 终端设置
  const [terminalSettings, setTerminalSettings] = useState({
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    theme: 'dark',
    cursorBlink: true,
    scrollback: 1000
  })
  
  // 通知设置
  const [notificationSettings, setNotificationSettings] = useState({
    desktop: true,
    sound: true,
    system: true,
    games: true
  })
  
  // 处理密码修改
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification({
        type: 'error',
        title: '密码不匹配',
        message: '新密码和确认密码不一致'
      })
      return
    }
    
    if (passwordForm.newPassword.length < 6) {
      addNotification({
        type: 'error',
        title: '密码太短',
        message: '新密码至少需要6个字符'
      })
      return
    }
    
    setPasswordLoading(true)
    
    try {
      const result = await changePassword(passwordForm.oldPassword, passwordForm.newPassword)
      
      if (result.success) {
        addNotification({
          type: 'success',
          title: '密码修改成功',
          message: '您的密码已成功更新'
        })
        
        setPasswordForm({
          oldPassword: '',
          newPassword: '',
          confirmPassword: '',
          showOldPassword: false,
          showNewPassword: false,
          showConfirmPassword: false
        })
      } else {
        addNotification({
          type: 'error',
          title: '密码修改失败',
          message: result.message
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: '修改失败',
        message: '网络错误，请稍后重试'
      })
    } finally {
      setPasswordLoading(false)
    }
  }
  
  // 保存设置
  const saveSettings = () => {
    // 这里可以调用API保存设置到后端
    addNotification({
      type: 'success',
      title: '设置已保存',
      message: '您的设置已成功保存'
    })
  }
  
  // 重置设置
  const resetSettings = () => {
    setTerminalSettings({
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      theme: 'dark',
      cursorBlink: true,
      scrollback: 1000
    })
    
    setNotificationSettings({
      desktop: true,
      sound: true,
      system: true,
      games: true
    })
    
    addNotification({
      type: 'info',
      title: '设置已重置',
      message: '所有设置已恢复为默认值'
    })
  }
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="card-game p-6">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-blue-500" />
          <h1 className="text-2xl font-bold text-white font-display">
            系统设置
          </h1>
        </div>
        <p className="text-gray-300 mt-2">
          自定义您的GSM3游戏面板体验
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 外观设置 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Palette className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-white">外观设置</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-200">主题模式</label>
                <p className="text-xs text-gray-400">选择浅色或深色主题</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
            
            <div className="pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-300">
                当前主题: <span className="font-semibold">{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
              </p>
            </div>
          </div>
        </div>
        
        {/* 通知设置 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-white">通知设置</h2>
          </div>
          
          <div className="space-y-4">
            {Object.entries(notificationSettings).map(([key, value]) => {
              const labels = {
                desktop: '桌面通知',
                sound: '声音提醒',
                system: '系统通知',
                games: '游戏通知'
              }
              
              return (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-200">
                    {labels[key as keyof typeof labels]}
                  </label>
                  <button
                    onClick={() => setNotificationSettings(prev => ({
                      ...prev,
                      [key]: !value
                    }))}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${value ? 'bg-green-600' : 'bg-gray-600'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${value ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* 终端设置 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Terminal className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-white">终端设置</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                字体大小
              </label>
              <input
                type="range"
                min="10"
                max="20"
                value={terminalSettings.fontSize}
                onChange={(e) => setTerminalSettings(prev => ({
                  ...prev,
                  fontSize: parseInt(e.target.value)
                }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10px</span>
                <span>{terminalSettings.fontSize}px</span>
                <span>20px</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                字体系列
              </label>
              <select
                value={terminalSettings.fontFamily}
                onChange={(e) => setTerminalSettings(prev => ({
                  ...prev,
                  fontFamily: e.target.value
                }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Consolas">Consolas</option>
                <option value="Monaco">Monaco</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                滚动缓冲区大小
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={terminalSettings.scrollback}
                onChange={(e) => setTerminalSettings(prev => ({
                  ...prev,
                  scrollback: parseInt(e.target.value)
                }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-200">
                光标闪烁
              </label>
              <button
                onClick={() => setTerminalSettings(prev => ({
                  ...prev,
                  cursorBlink: !prev.cursorBlink
                }))}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${terminalSettings.cursorBlink ? 'bg-blue-600' : 'bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${terminalSettings.cursorBlink ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
        
        {/* 账户安全 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-white">账户安全</h2>
          </div>
          
          {/* 用户信息 */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg">
            <div className="flex items-center space-x-3">
              <User className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-white font-medium">{user?.username}</p>
                <p className="text-sm text-gray-400">
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </p>
              </div>
            </div>
          </div>
          
          {/* 修改密码表单 */}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                当前密码
              </label>
              <div className="relative">
                <input
                  type={passwordForm.showOldPassword ? 'text' : 'password'}
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm(prev => ({
                    ...prev,
                    oldPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入当前密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showOldPassword: !prev.showOldPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {passwordForm.showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                新密码
              </label>
              <div className="relative">
                <input
                  type={passwordForm.showNewPassword ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({
                    ...prev,
                    newPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入新密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showNewPassword: !prev.showNewPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {passwordForm.showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                确认新密码
              </label>
              <div className="relative">
                <input
                  type={passwordForm.showConfirmPassword ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({
                    ...prev,
                    confirmPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请再次输入新密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showConfirmPassword: !prev.showConfirmPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {passwordForm.showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={passwordLoading || !passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              className="w-full btn-game py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordLoading ? '修改中...' : '修改密码'}
            </button>
          </form>
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="card-game p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">设置操作</h3>
            <p className="text-sm text-gray-400">保存或重置您的设置</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={resetSettings}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>重置设置</span>
            </button>
            
            <button
              onClick={saveSettings}
              className="btn-game px-4 py-2 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>保存设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage