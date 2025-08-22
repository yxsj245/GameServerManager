import { useState, useEffect } from 'react'
import { isTouchDevice, isSmallScreen } from '@/utils/touchUtils'

export interface TouchAdaptationState {
  isTouchDevice: boolean
  isSmallScreen: boolean
  shouldShowMobileUI: boolean
  shouldUseListView: boolean
  shouldHideViewToggle: boolean
}

export const useTouchAdaptation = () => {
  const [state, setState] = useState<TouchAdaptationState>({
    isTouchDevice: false,
    isSmallScreen: false,
    shouldShowMobileUI: false,
    shouldUseListView: false,
    shouldHideViewToggle: false
  })

  useEffect(() => {
    const updateState = () => {
      const touchDevice = isTouchDevice()
      const smallScreen = isSmallScreen()
      const shouldShowMobile = touchDevice && smallScreen
      
      setState({
        isTouchDevice: touchDevice,
        isSmallScreen: smallScreen,
        shouldShowMobileUI: shouldShowMobile,
        shouldUseListView: shouldShowMobile,
        shouldHideViewToggle: shouldShowMobile
      })
    }

    // 初始检测
    updateState()

    // 监听窗口大小变化
    window.addEventListener('resize', updateState)
    
    return () => {
      window.removeEventListener('resize', updateState)
    }
  }, [])

  return state
}
