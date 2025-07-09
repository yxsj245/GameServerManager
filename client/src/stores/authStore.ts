import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthState, User, LoginRequest } from '@/types'
import apiClient from '@/utils/api'
import socketClient from '@/utils/socket'

interface AuthStore extends AuthState {
  login: (credentials: LoginRequest) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  verifyToken: () => Promise<boolean>
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>
  changeUsername: (newUsername: string) => Promise<{ success: boolean; message: string }>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,

      login: async (credentials: LoginRequest) => {
        set({ loading: true, error: null })
        
        try {
          const response = await apiClient.login(credentials)
          
          if (response.success && response.token && response.user) {
            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              loading: false,
              error: null,
            })
            
            // 更新Socket认证
            socketClient.updateAuth(response.token)
            
            return { success: true, message: response.message }
          } else {
            set({
              isAuthenticated: false,
              user: null,
              token: null,
              loading: false,
              error: response.message,
            })
            
            return { success: false, message: response.message }
          }
        } catch (error: any) {
          const errorMessage = error.message || '登录失败，请稍后重试'
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: errorMessage,
          })
          
          return { success: false, message: errorMessage }
        }
      },

      logout: async () => {
        set({ loading: true })
        
        try {
          await apiClient.logout()
        } catch (error) {
          console.error('登出请求失败:', error)
        } finally {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: null,
          })
          
          // 断开Socket连接
          socketClient.disconnect()
          
          // 重定向到登录页
          window.location.href = '/login'
        }
      },

      verifyToken: async () => {
        const { token } = get()
        
        if (!token) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
          })
          return false
        }
        
        set({ loading: true })
        
        try {
          const response = await apiClient.verifyToken()
          
          if (response.success && response.user) {
            set({
              isAuthenticated: true,
              user: response.user,
              loading: false,
              error: null,
            })
            
            return true
          } else {
            set({
              isAuthenticated: false,
              user: null,
              token: null,
              loading: false,
              error: response.message,
            })
            
            return false
          }
        } catch (error: any) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: error.message || 'Token验证失败',
          })
          
          return false
        }
      },

      changePassword: async (oldPassword: string, newPassword: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await apiClient.changePassword(oldPassword, newPassword)
          
          set({ loading: false })
          
          if (!response.success) {
            set({ error: response.message })
          }
          
          return response
        } catch (error: any) {
          const errorMessage = error.message || '修改密码失败'
          set({
            loading: false,
            error: errorMessage,
          })
          
          return { success: false, message: errorMessage }
        }
      },

      changeUsername: async (newUsername: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await apiClient.changeUsername(newUsername)
          
          if (response.success && response.user) {
            // 更新用户信息
            set({
              user: response.user,
              loading: false,
              error: null,
            })
          } else {
            set({
              loading: false,
              error: response.message,
            })
          }
          
          return response
        } catch (error: any) {
          const errorMessage = error.message || '修改用户名失败'
          set({
            loading: false,
            error: errorMessage,
          })
          
          return { success: false, message: errorMessage }
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ loading })
      },
    }),
    {
      name: 'gsm3-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
)