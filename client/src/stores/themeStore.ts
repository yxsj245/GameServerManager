import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ThemeState, Theme } from '@/types'

interface ThemeStore extends ThemeState {
  setTheme: (theme: Theme) => void
  initTheme: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      toggleTheme: () => {
        const { theme } = get()
        const newTheme = theme === 'light' ? 'dark' : 'light'
        set({ theme: newTheme })
        applyTheme(newTheme)
      },

      setTheme: (theme: Theme) => {
        set({ theme })
        applyTheme(theme)
      },

      initTheme: () => {
        const { theme } = get()
        applyTheme(theme)
      },
    }),
    {
      name: 'gsm3-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)

// 应用主题到DOM
function applyTheme(theme: Theme) {
  const root = document.documentElement
  
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  
  // 更新meta标签
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      'content',
      theme === 'dark' ? '#1a1a2e' : '#667eea'
    )
  }
}

// 监听系统主题变化
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  mediaQuery.addEventListener('change', (e) => {
    const { theme } = useThemeStore.getState()
    // 如果用户没有手动设置过主题，跟随系统主题
    const hasUserPreference = localStorage.getItem('gsm3-theme')
    if (!hasUserPreference) {
      const systemTheme = e.matches ? 'dark' : 'light'
      useThemeStore.getState().setTheme(systemTheme)
    }
  })
}