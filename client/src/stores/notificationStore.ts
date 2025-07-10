import { create } from 'zustand'
import { NotificationState, Notification } from '@/types'

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const currentNotifications = get().notifications
    
    // 检查是否已存在相同标题和消息的通知（在最近3秒内）
    const now = new Date().getTime()
    const duplicateNotification = currentNotifications.find(n => 
      n.title === notification.title && 
      n.message === notification.message &&
      (now - new Date(n.timestamp).getTime()) < 3000 // 3秒内的重复通知
    )
    
    // 如果发现重复通知，则不添加新通知
    if (duplicateNotification) {
      console.log('检测到重复通知，已忽略:', notification.title)
      return
    }
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date().toISOString(),
    }
    
    set((state) => ({
      notifications: [...state.notifications, newNotification]
    }))
    
    // 自动移除通知
    if (notification.duration !== 0) {
      const duration = notification.duration || 5000
      setTimeout(() => {
        get().removeNotification(id)
      }, duration)
    }
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }))
  },
  
  clearNotifications: () => {
    set({ notifications: [] })
  },
}))