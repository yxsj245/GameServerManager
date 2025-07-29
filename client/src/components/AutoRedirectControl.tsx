import React from 'react'
import { useAuthStore } from '@/stores/authStore'

/**
 * 自动跳转控制组件
 * 用于控制登录过期时是否自动跳转到登录页面
 */
const AutoRedirectControl: React.FC = () => {
  const { autoRedirectOnExpire, setAutoRedirectOnExpire } = useAuthStore()

  const handleToggle = () => {
    setAutoRedirectOnExpire(!autoRedirectOnExpire)
  }

  return (
    <div className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          自动跳转登录页面
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          当登录过期时自动跳转到登录界面
        </p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={autoRedirectOnExpire}
          onChange={handleToggle}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  )
}

export default AutoRedirectControl