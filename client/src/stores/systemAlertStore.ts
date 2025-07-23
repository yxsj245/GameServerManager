import { create } from 'zustand'
import { SystemAlert } from '@/types'

interface SystemAlertState {
  alerts: SystemAlert[]
  alertHistory: Map<string, number> // 存储告警类型和最后通知时间
  showAlert: boolean
  currentAlert: SystemAlert | null
  isClosing: boolean
  
  // 方法
  addAlert: (alert: SystemAlert) => void
  resolveAlert: (alert: SystemAlert) => void
  showAlertModal: (alert: SystemAlert) => void
  closeAlertModal: () => void
  shouldShowAlert: (alert: SystemAlert) => boolean
  clearAlertHistory: () => void
}

export const useSystemAlertStore = create<SystemAlertState>((set, get) => ({
  alerts: [],
  alertHistory: new Map(),
  showAlert: false,
  currentAlert: null,
  isClosing: false,

  addAlert: (alert) => {
    const state = get()
    
    // 检查是否应该显示告警（1小时内不重复通知）
    if (state.shouldShowAlert(alert)) {
      // 更新告警历史
      const newHistory = new Map(state.alertHistory)
      newHistory.set(alert.type, Date.now())
      
      // 添加到告警列表
      const existingIndex = state.alerts.findIndex(a => a.id === alert.id)
      let newAlerts
      if (existingIndex >= 0) {
        newAlerts = [...state.alerts]
        newAlerts[existingIndex] = alert
      } else {
        newAlerts = [...state.alerts, alert]
      }
      
      set({
        alerts: newAlerts,
        alertHistory: newHistory
      })
      
      // 如果当前没有显示告警弹窗，则显示新告警
      if (!state.showAlert) {
        state.showAlertModal(alert)
      }
    }
  },

  resolveAlert: (alert) => {
    set((state) => ({
      alerts: state.alerts.filter(a => a.id !== alert.id)
    }))
  },

  showAlertModal: (alert) => {
    set({
      showAlert: true,
      currentAlert: alert,
      isClosing: false
    })
  },

  closeAlertModal: () => {
    set({ isClosing: true })
    setTimeout(() => {
      set({
        showAlert: false,
        currentAlert: null,
        isClosing: false
      })
    }, 300) // 与CSS动画时间匹配
  },

  shouldShowAlert: (alert) => {
    const state = get()
    const lastNotificationTime = state.alertHistory.get(alert.type)
    
    if (!lastNotificationTime) {
      return true // 第一次告警
    }
    
    const oneHourInMs = 60 * 60 * 1000 // 1小时
    const timeSinceLastNotification = Date.now() - lastNotificationTime
    
    return timeSinceLastNotification >= oneHourInMs
  },

  clearAlertHistory: () => {
    set({ alertHistory: new Map() })
  }
}))