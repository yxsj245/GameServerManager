import React, { useState, useEffect } from 'react'
import { useNotificationStore } from '@/stores/notificationStore'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Notification } from '@/types'

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotificationStore()
  const [animatingNotifications, setAnimatingNotifications] = useState<Set<string>>(new Set())
  const [exitingNotifications, setExitingNotifications] = useState<Set<string>>(new Set())

  // 处理新通知的进入动画
  useEffect(() => {
    const newNotifications = notifications.filter(n => !animatingNotifications.has(n.id))
    if (newNotifications.length > 0) {
      const newIds = new Set(animatingNotifications)
      newNotifications.forEach(n => newIds.add(n.id))
      setAnimatingNotifications(newIds)
    }
  }, [notifications, animatingNotifications])

  // 处理通知移除的退出动画
  const handleRemoveNotification = (id: string) => {
    setExitingNotifications(prev => new Set([...prev, id]))
    setTimeout(() => {
      removeNotification(id)
      setExitingNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      setAnimatingNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }, 300) // 与CSS动画时间匹配
  }
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }
  
  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
    }
  }
  
  if (notifications.length === 0) {
    return null
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const isExiting = exitingNotifications.has(notification.id)
        const isEntering = !animatingNotifications.has(notification.id)
        
        return (
          <div
            key={notification.id}
            className={`
              ${getBackgroundColor(notification.type)}
              border rounded-lg p-4 shadow-lg backdrop-blur-sm
              transform transition-all duration-300 ease-in-out
              hover:scale-105
              ${
                isExiting
                  ? 'translate-x-full opacity-0 scale-95'
                  : isEntering
                  ? 'translate-x-0 opacity-100 scale-100 animate-slide-in-right'
                  : 'translate-x-0 opacity-100 scale-100'
              }
            `}
            style={{
              animation: isEntering ? 'slideInRight 0.3s ease-out forwards' : undefined
            }}
          >
            <div className="flex items-start space-x-3">
              {getIcon(notification.type)}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {notification.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => handleRemoveNotification(notification.id)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default NotificationContainer