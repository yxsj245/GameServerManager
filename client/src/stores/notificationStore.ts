import { create } from 'zustand'
import { NotificationState, Notification } from '@/types'

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  
  addNotification: (notification) => {
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