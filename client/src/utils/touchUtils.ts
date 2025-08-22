// 触摸屏工具函数
export interface TouchPosition {
  x: number
  y: number
}

export interface LongPressOptions {
  delay?: number
  threshold?: number
}

// 检测是否为触摸设备
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

// 检测是否为小屏设备
export const isSmallScreen = (): boolean => {
  return window.innerWidth < 768
}

// 长按检测Hook
export const useLongPress = (
  callback: (event: TouchEvent | MouseEvent) => void,
  options: LongPressOptions = {}
) => {
  const { delay = 500, threshold = 10 } = options
  let timeoutId: NodeJS.Timeout | null = null
  let startPosition: TouchPosition | null = null

  const start = (event: TouchEvent | MouseEvent) => {
    const position = getEventPosition(event)
    startPosition = position

    timeoutId = setTimeout(() => {
      callback(event)
    }, delay)
  }

  const move = (event: TouchEvent | MouseEvent) => {
    if (!startPosition || !timeoutId) return

    const currentPosition = getEventPosition(event)
    const distance = Math.sqrt(
      Math.pow(currentPosition.x - startPosition.x, 2) +
      Math.pow(currentPosition.y - startPosition.y, 2)
    )

    if (distance > threshold) {
      clear()
    }
  }

  const clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    startPosition = null
  }

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: clear,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: clear,
    onMouseLeave: clear
  }
}

// 获取事件位置
export const getEventPosition = (event: TouchEvent | MouseEvent): TouchPosition => {
  if ('touches' in event && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
  }
  
  if ('clientX' in event) {
    return {
      x: event.clientX,
      y: event.clientY
    }
  }

  return { x: 0, y: 0 }
}
