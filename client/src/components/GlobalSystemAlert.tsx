import React from 'react'
import { useSystemAlertStore } from '@/stores/systemAlertStore'
import { AlertTriangle, AlertCircle, X, Cpu, MemoryStick, HardDrive } from 'lucide-react'

const GlobalSystemAlert: React.FC = () => {
  const { showAlert, currentAlert, isClosing, closeAlertModal } = useSystemAlertStore()

  if (!showAlert || !currentAlert) {
    return null
  }

  const getAlertIcon = () => {
    switch (currentAlert.type) {
      case 'cpu':
        return <Cpu className="w-8 h-8 text-blue-500" />
      case 'memory':
        return <MemoryStick className="w-8 h-8 text-green-500" />
      case 'disk':
        return <HardDrive className="w-8 h-8 text-purple-500" />
      default:
        return <AlertTriangle className="w-8 h-8 text-yellow-500" />
    }
  }

  const getAlertTitle = () => {
    switch (currentAlert.type) {
      case 'cpu':
        return 'CPU使用率告警'
      case 'memory':
        return '内存使用率告警'
      case 'disk':
        return '磁盘使用率告警'
      default:
        return '系统告警'
    }
  }

  const getAlertColor = () => {
    if (currentAlert.level === 'critical') {
      return 'border-red-500 bg-red-50 dark:bg-red-900/20'
    } else if (currentAlert.level === 'warning') {
      return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
    }
    return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
  }

  const getProgressColor = () => {
    if (currentAlert.level === 'critical') {
      return 'bg-red-500'
    } else if (currentAlert.level === 'warning') {
      return 'bg-yellow-500'
    }
    return 'bg-blue-500'
  }

  const getTextColor = () => {
    if (currentAlert.level === 'critical') {
      return 'text-red-600 dark:text-red-400'
    } else if (currentAlert.level === 'warning') {
      return 'text-yellow-600 dark:text-yellow-400'
    }
    return 'text-blue-600 dark:text-blue-400'
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isClosing ? 'bg-opacity-0' : 'bg-opacity-75'
      } bg-black`}
      onClick={closeAlertModal}
    >
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        } ${getAlertColor()} border-2`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={closeAlertModal}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* 告警图标和标题 */}
          <div className="flex items-center space-x-4 mb-4">
            {getAlertIcon()}
            <div>
              <h3 className="text-lg font-semibold text-black dark:text-white">
                {getAlertTitle()}
              </h3>
              <p className={`text-sm ${getTextColor()}`}>
                {currentAlert.level === 'critical' ? '严重告警' : '警告'}
              </p>
            </div>
          </div>

          {/* 告警详情 */}
          <div className="space-y-4">
            <div>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                {currentAlert.message}
              </p>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>当前值: {currentAlert.value.toFixed(1)}%</span>
                <span>阈值: {currentAlert.threshold}%</span>
              </div>
              
              {/* 进度条 */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${Math.min(currentAlert.value, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* 时间信息 */}
            <div className="text-xs text-gray-500 dark:text-gray-400">
              告警时间: {new Date(currentAlert.timestamp).toLocaleString()}
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={closeAlertModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GlobalSystemAlert