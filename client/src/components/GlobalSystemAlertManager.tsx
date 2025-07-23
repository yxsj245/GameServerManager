import React, { useEffect } from 'react'
import { useSystemAlertStore } from '@/stores/systemAlertStore'
import { useNotificationStore } from '@/stores/notificationStore'
import socketClient from '@/utils/socket'
import { SystemAlert } from '@/types'

const GlobalSystemAlertManager: React.FC = () => {
  const { addAlert, resolveAlert } = useSystemAlertStore()
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    // 监听系统告警
    const handleSystemAlert = (alert: SystemAlert) => {
      console.log('收到系统告警:', alert)
      
      // 添加到告警存储
      addAlert(alert)
      
      // 同时发送通知
      addNotification({
        type: alert.level === 'critical' ? 'error' : 'warning',
        title: '系统资源告警',
        message: `${alert.message}: ${alert.value.toFixed(1)}%`,
        duration: 5000
      })
    }

    // 监听告警解除
    const handleSystemAlertResolved = (alert: SystemAlert) => {
      console.log('系统告警已解除:', alert)
      
      // 从告警存储中移除
      resolveAlert(alert)
      
      // 发送解除通知
      addNotification({
        type: 'success',
        title: '系统告警解除',
        message: `${alert.message}已恢复正常`,
        duration: 3000
      })
    }

    // 注册事件监听器
    socketClient.on('system-alert', handleSystemAlert)
    socketClient.on('system-alert-resolved', handleSystemAlertResolved)

    // 清理函数
    return () => {
      socketClient.off('system-alert', handleSystemAlert)
      socketClient.off('system-alert-resolved', handleSystemAlertResolved)
    }
  }, [addAlert, resolveAlert, addNotification])

  // 这个组件不渲染任何内容，只负责管理告警逻辑
  return null
}

export default GlobalSystemAlertManager