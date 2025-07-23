import { create } from 'zustand'
import { SystemInfo } from '@/types'
import apiClient from '@/utils/api'

interface SystemStore {
  systemInfo: SystemInfo | null
  isLinux: boolean
  loading: boolean
  error: string | null
  lastFetched: number | null
  
  // Actions
  fetchSystemInfo: () => Promise<void>
  clearError: () => void
}

// 缓存时间：5分钟
const CACHE_DURATION = 5 * 60 * 1000

export const useSystemStore = create<SystemStore>((set, get) => ({
  systemInfo: null,
  isLinux: false,
  loading: false,
  error: null,
  lastFetched: null,

  fetchSystemInfo: async () => {
    const state = get()
    const now = Date.now()
    
    // 如果有缓存且未过期，直接返回
    if (state.systemInfo && state.lastFetched && (now - state.lastFetched) < CACHE_DURATION) {
      return
    }
    
    // 如果正在加载，避免重复请求
    if (state.loading) {
      return
    }

    set({ loading: true, error: null })

    try {
      const response = await apiClient.getSystemInfo()
      if (response.success && response.data) {
        const platform = response.data.platform.toLowerCase()
        const isLinux = platform.includes('linux')
        
        set({
          systemInfo: response.data,
          isLinux,
          loading: false,
          lastFetched: now,
          error: null
        })
      } else {
        throw new Error('获取系统信息失败')
      }
    } catch (error: any) {
      console.error('获取系统信息失败:', error)
      
      // 如果API调用失败，回退到navigator.platform
      const platform = navigator.platform.toLowerCase()
      const isLinux = platform.includes('linux') || platform.includes('unix')
      
      set({
        isLinux,
        loading: false,
        error: error.message || '获取系统信息失败',
        // 不更新 lastFetched，这样下次还会尝试重新获取
      })
    }
  },

  clearError: () => set({ error: null })
}))