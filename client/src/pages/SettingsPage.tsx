import React, { useState } from 'react'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  Settings,
  Palette,
  Shield,
  User,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Check,
  Edit2
} from 'lucide-react'

const SettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore()
  const { user, changePassword, changeUsername } = useAuthStore()
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
  
  // 用户名修改状态
  const [usernameForm, setUsernameForm] = useState({
    newUsername: '',
    isEditing: false
  })
  const [usernameLoading, setUsernameLoading] = useState(false)
  

  
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
  
  // 处理用户名修改
  const handleUsernameChange = async () => {
    if (!usernameForm.newUsername.trim()) {
      addNotification({
        type: 'error',
        title: '输入错误',
        message: '请输入新用户名'
      })
      return
    }
    
    if (!/^[a-zA-Z0-9]{3,30}$/.test(usernameForm.newUsername)) {
      addNotification({
        type: 'error',
        title: '格式错误',
        message: '用户名只能包含字母和数字，长度为3-30个字符'
      })
      return
    }
    
    if (usernameForm.newUsername === user?.username) {
      addNotification({
        type: 'warning',
        title: '无需修改',
        message: '新用户名与当前用户名相同'
      })
      return
    }
    
    setUsernameLoading(true)
    
    try {
      const result = await changeUsername(usernameForm.newUsername)
      
      if (result.success) {
        addNotification({
          type: 'success',
          title: '用户名修改成功',
          message: '您的用户名已成功更新'
        })
        
        setUsernameForm({
          newUsername: '',
          isEditing: false
        })
      } else {
        addNotification({
          type: 'error',
          title: '用户名修改失败',
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
      setUsernameLoading(false)
    }
  }
  
  // 取消用户名编辑
  const handleCancelUsernameEdit = () => {
    setUsernameForm({
      newUsername: '',
      isEditing: false
    })
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
          <h1 className="text-2xl font-bold text-black dark:text-white font-display">
            系统设置
          </h1>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mt-2">
          自定义您的GSM3游戏面板体验
        </p>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* 外观设置 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Palette className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-black dark:text-white">外观设置</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">主题模式</label>
                <p className="text-xs text-gray-600 dark:text-gray-400">选择浅色或深色主题</p>
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
              <p className="text-sm text-gray-700 dark:text-gray-300">
                当前主题: <span className="font-semibold">{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
              </p>
            </div>
          </div>
        </div>
        

        
        {/* 账户安全 */}
        <div className="card-game p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-black dark:text-white">账户安全</h2>
          </div>
          
          {/* 用户信息 */}
          <div className="mb-6 p-4 bg-white/5 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <User className="w-8 h-8 text-blue-500" />
                <div>
                  {usernameForm.isEditing ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={usernameForm.newUsername}
                        onChange={(e) => setUsernameForm(prev => ({
                          ...prev,
                          newUsername: e.target.value
                        }))}
                        className="px-2 py-1 bg-white/10 border border-white/20 rounded text-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="输入新用户名"
                        disabled={usernameLoading}
                      />
                      <button
                        onClick={handleUsernameChange}
                        disabled={usernameLoading}
                        className="p-1 text-green-500 hover:text-green-400 disabled:opacity-50"
                        title="确认修改"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelUsernameEdit}
                        disabled={usernameLoading}
                        className="p-1 text-gray-500 hover:text-gray-400 disabled:opacity-50"
                        title="取消修改"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                       <p className="text-black dark:text-white font-medium">{user?.username}</p>
                       <button
                         onClick={() => setUsernameForm(prev => ({
                           ...prev,
                           isEditing: true,
                           newUsername: user?.username || ''
                         }))}
                         className="p-1 text-blue-500 hover:text-blue-400"
                         title="修改用户名"
                       >
                         <Edit2 className="w-4 h-4" />
                       </button>
                     </div>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.role === 'admin' ? '管理员' : '普通用户'}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* 修改密码表单 */}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
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
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入当前密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showOldPassword: !prev.showOldPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                >
                  {passwordForm.showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
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
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入新密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showNewPassword: !prev.showNewPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
                >
                  {passwordForm.showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
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
                  className="w-full px-3 py-2 pr-10 bg-white/10 border border-white/20 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请再次输入新密码"
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  onClick={() => setPasswordForm(prev => ({
                    ...prev,
                    showConfirmPassword: !prev.showConfirmPassword
                  }))}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white"
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
            <h3 className="text-lg font-semibold text-black dark:text-white mb-1">设置操作</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">保存或重置您的设置</p>
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